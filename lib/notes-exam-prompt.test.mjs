import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNotesExamPrompt,
  getDifficultyDistribution,
} from "./notes-exam-prompt.ts";
import { MAX_NOTES_FILES } from "./notes-upload-limits.ts";
import { validateNotesFiles } from "./notes-extract.ts";

describe("getDifficultyDistribution", () => {
  it("returns shifted ratios for easy/medium/hard presets", () => {
    assert.deepEqual(getDifficultyDistribution("easy"), { easy: 50, medium: 40, hard: 10 });
    assert.deepEqual(getDifficultyDistribution("medium"), { easy: 20, medium: 50, hard: 30 });
    assert.deepEqual(getDifficultyDistribution("hard"), { easy: 10, medium: 40, hard: 50 });
  });
});

describe("buildNotesExamPrompt", () => {
  it("injects subject, count, difficulty, and optional topic", () => {
    const prompt = buildNotesExamPrompt({
      subject: "AP_BIOLOGY",
      questionCount: 12,
      difficulty: "hard",
      topicTitle: "Unit 3 — Cellular Energetics",
    });
    assert.match(prompt, /AP Biology/);
    assert.match(prompt, /12 questions/);
    assert.match(prompt, /~10% easy, ~40% medium, ~50% hard/);
    assert.match(prompt, /Unit 3 — Cellular Energetics/);
    assert.match(prompt, /exactly 4 answer choices \(A–D\)/);
    assert.match(prompt, /application\/json|"topic_title"/);
  });

  it("derives topic when optional title is omitted", () => {
    const prompt = buildNotesExamPrompt({
      subject: "AP_US_HISTORY",
      questionCount: 10,
      difficulty: "medium",
    });
    assert.match(prompt, /Derive a concise unit\/topic title/);
    assert.doesNotMatch(prompt, /Use this unit\/topic title exactly/);
  });

  it("includes truncation notice when provided", () => {
    const prompt = buildNotesExamPrompt({
      subject: "AP_CALCULUS_AB",
      questionCount: 8,
      difficulty: "easy",
      truncationNotice: "Notes were truncated.",
    });
    assert.match(prompt, /Notes were truncated/);
  });
});

describe("validateNotesFiles", () => {
  it("rejects empty and too many files", () => {
    assert.equal(validateNotesFiles([]).ok, false);
    const tooMany = Array.from({ length: MAX_NOTES_FILES + 1 }, (_, i) => ({
      name: `file-${i}.txt`,
      size: 100,
      kind: "txt",
    }));
    assert.equal(validateNotesFiles(tooMany).ok, false);
  });

  it("accepts supported file set", () => {
    const result = validateNotesFiles([
      { name: "notes.txt", size: 500, kind: "txt" },
      { name: "chapter.pdf", size: 1000, kind: "pdf" },
    ]);
    assert.equal(result.ok, true);
  });
});
