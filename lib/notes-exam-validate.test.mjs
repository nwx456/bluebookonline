import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_PARTIAL_ACCEPT_QUESTIONS,
  notesExamToQuestionRows,
  validateNotesExamResponse,
} from "./notes-exam-validate.ts";

function sampleQuestion(n) {
  return {
    question_number: n,
    question_text: `Question ${n}?`,
    passage_text: null,
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    correct_answer: "A",
    difficulty: "medium",
    question_category: "conceptual",
    explanation: `Because A is correct for question ${n}.`,
  };
}

describe("validateNotesExamResponse", () => {
  it("parses valid JSON exam payload", () => {
    const raw = JSON.stringify({
      topic_title: "Photosynthesis",
      subtopic_allocation: [{ subtopic: "Light reactions", question_numbers: [1, 2] }],
      truncation_notice: null,
      questions: [sampleQuestion(1), sampleQuestion(2), ...Array.from({ length: 14 }, (_, i) => sampleQuestion(i + 3))],
    });
    const result = validateNotesExamResponse({
      raw,
      requestedCount: 16,
      difficulty: "medium",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.exam.questions.length, 16);
      assert.equal(result.exam.topic_title, "Photosynthesis");
    }
  });

  it("accepts partial exams above minimum threshold with warning", () => {
    const questions = Array.from({ length: 16 }, (_, i) => sampleQuestion(i + 1));
    const raw = JSON.stringify({
      topic_title: "Genetics",
      subtopic_allocation: [],
      questions,
    });
    const result = validateNotesExamResponse({
      raw,
      requestedCount: 20,
      difficulty: "hard",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.exam.questions.length, 16);
      assert.ok(result.warnings.some((w) => w.includes("Requested 20")));
    }
  });

  it("rejects insufficient valid questions", () => {
    const raw = JSON.stringify({
      topic_title: "Too few",
      questions: Array.from({ length: 5 }, (_, i) => sampleQuestion(i + 1)),
    });
    const result = validateNotesExamResponse({
      raw,
      requestedCount: 20,
      difficulty: "medium",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, "INSUFFICIENT_QUESTIONS");
      assert.match(result.message, new RegExp(String(MIN_PARTIAL_ACCEPT_QUESTIONS)));
    }
  });

  it("rejects invalid correct answers", () => {
    const bad = sampleQuestion(1);
    bad.correct_answer = "Z";
    const questions = Array.from({ length: MIN_PARTIAL_ACCEPT_QUESTIONS }, (_, i) =>
      i === 0 ? bad : sampleQuestion(i + 1)
    );
    const raw = JSON.stringify({ topic_title: "Bad answer", questions });
    const result = validateNotesExamResponse({
      raw,
      requestedCount: MIN_PARTIAL_ACCEPT_QUESTIONS,
      difficulty: "medium",
    });
    assert.equal(result.ok, false);
  });
});

describe("notesExamToQuestionRows", () => {
  it("maps generated questions to DB row shape", () => {
    const rows = notesExamToQuestionRows("upload-123", {
      topic_title: "Test",
      subtopic_allocation: [],
      truncation_notice: null,
      questions: [sampleQuestion(1)],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].upload_id, "upload-123");
    assert.equal(rows[0].option_a, "Alpha");
    assert.equal(rows[0].explanation, "Because A is correct for question 1.");
    assert.equal(rows[0].question_type, "mcq");
  });
});
