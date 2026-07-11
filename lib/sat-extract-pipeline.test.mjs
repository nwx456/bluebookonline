import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSatSectionExtractPipeline } from "./sat-extract-pipeline.ts";

function makeQuestion(section, modNum, overrides = {}) {
  return {
    type: "text",
    content: `Sample stem ${Math.random().toString(36).slice(2)} that is long enough to survive salvage.`,
    image_description: "Sample passage or figure description.",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    question_type: "mcq",
    correct: "A",
    accepted_answers: null,
    sat_section: section,
    sat_module: modNum,
    sat_module_variant: null,
    ...overrides,
  };
}

function mockExtractor(scenario) {
  let call = 0;
  return async (_args) => {
    const result = scenario[call] ?? { questions: [], rawText: "[]" };
    call += 1;
    return result;
  };
}

describe("runSatSectionExtractPipeline", () => {
  it("runs two section calls for non-adaptive full test (rw + math)", async () => {
    const seenPrompts = [];
    let call = 0;
    const extractor = async (args) => {
      seenPrompts.push(args.userPrompt);
      call += 1;
      const section = call === 1 ? "rw" : "math";
      return {
        questions: [
          makeQuestion(section, 1),
          makeQuestion(section, 1),
          makeQuestion(section, 2),
        ],
        rawText: "[]",
      };
    };
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      sectionFilter: null,
      effectiveAdaptiveMode: "none",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(call, 2);
    assert.equal(seenPrompts.length, 2);
    assert.ok(seenPrompts[0].includes("Reading & Writing"));
    assert.ok(seenPrompts[1].includes("Math"));
    assert.equal(result.questions.length, 6);
    for (const q of result.questions) {
      assert.ok(q.sat_section === "rw" || q.sat_section === "math");
      assert.ok(q.sat_module === 1 || q.sat_module === 2);
    }
  });

  it("runs two section calls in six_module full test", async () => {
    let call = 0;
    const extractor = async () => {
      call += 1;
      const section = call === 1 ? "rw" : "math";
      return {
        questions: [
          makeQuestion(section, 1),
          makeQuestion(section, 2, { sat_module_variant: "easy" }),
          makeQuestion(section, 2, { sat_module_variant: "hard" }),
        ],
        rawText: "[]",
      };
    };
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      sectionFilter: null,
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(call, 2);
    assert.equal(result.questions.length, 6);
    const rwEasy = result.questions.filter(
      (q) => q.sat_section === "rw" && q.sat_module === 2 && q.sat_module_variant === "easy"
    );
    const rwHard = result.questions.filter(
      (q) => q.sat_section === "rw" && q.sat_module === 2 && q.sat_module_variant === "hard"
    );
    assert.equal(rwEasy.length, 1);
    assert.equal(rwHard.length, 1);
  });

  it("retries once when the first section call returns zero", async () => {
    const extractor = mockExtractor([
      // rw first attempt: empty
      { questions: [], rawText: "[]" },
      // rw retry: 3 questions
      {
        questions: [
          makeQuestion("rw", 1),
          makeQuestion("rw", 1),
          makeQuestion("rw", 1),
        ],
        rawText: "[]",
      },
      // math first attempt: has content
      {
        questions: [makeQuestion("math", 1), makeQuestion("math", 2)],
        rawText: "[]",
      },
    ]);
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      sectionFilter: null,
      effectiveAdaptiveMode: "none",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    const rw1 = result.questions.filter(
      (q) => q.sat_section === "rw" && q.sat_module === 1
    );
    assert.equal(rw1.length, 3);
    assert.equal(result.questions.length, 5);
  });

  it("keeps section empty (no throw) when both attempts return zero", async () => {
    const extractor = async () => ({ questions: [], rawText: "[]" });
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      sectionFilter: null,
      effectiveAdaptiveMode: "none",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(result.questions.length, 0);
  });

  it("respects section filter (only one rw call)", async () => {
    let call = 0;
    const extractor = async (args) => {
      call += 1;
      assert.ok(args.userPrompt.includes("Reading & Writing"));
      return {
        questions: [makeQuestion("rw", 1), makeQuestion("rw", 2)],
        rawText: "[]",
      };
    };
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_RW",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "none",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(call, 1);
    assert.equal(result.questions.length, 2);
  });
});
