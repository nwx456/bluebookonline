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

function bucketCountFromPrompt(prompt, counts) {
  if (prompt.includes("FIRST module only")) return counts.m1 ?? 1;
  if (prompt.includes("EASY path")) return counts.m2Easy ?? 1;
  if (prompt.includes("HARD path")) return counts.m2Hard ?? 1;
  return 1;
}

function makeBucketQuestions(section, modNum, count, variant = null) {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion(section, modNum, {
      content: `Bucket stem ${modNum}-${variant ?? "m1"}-${i} with enough length.`,
      image_description: `Passage ${i}`,
      sat_module_variant: variant,
    })
  );
}

describe("runSatSectionExtractPipeline (single-shot delegate)", () => {
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
      satFormat: "full_test",
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
  });

  it("runs six bucket calls in six_module full test", async () => {
    let call = 0;
    const extractor = async (args) => {
      call += 1;
      const section = args.userPrompt.includes("Math") ? "math" : "rw";
      const n = bucketCountFromPrompt(args.userPrompt, { m1: 1, m2Easy: 1, m2Hard: 1 });
      let modNum = 1;
      let variant = null;
      if (args.userPrompt.includes("EASY path")) {
        modNum = 2;
        variant = "easy";
      } else if (args.userPrompt.includes("HARD path")) {
        modNum = 2;
        variant = "hard";
      }
      return {
        questions: makeBucketQuestions(section, modNum, n, variant),
        rawText: "[]",
      };
    };
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      satFormat: "full_test",
      sectionFilter: null,
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: {
        rw1: 1,
        rw2easy: 1,
        rw2hard: 1,
        math1: 1,
        math2easy: 1,
        math2hard: 1,
      },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(call, 6);
    assert.equal(result.questions.length, 6);
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
      satFormat: "section_test",
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

  it("returns MODEL_EMPTY_ARRAY error when section extraction returns []", async () => {
    const extractor = async () => ({
      questions: [],
      rawText: "[]",
      failureReason: "valid_array",
    });
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "none",
      userModuleCounts: null,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(result.questions.length, 0);
    assert.equal(result.extractionErrorCode, "MODEL_EMPTY_ARRAY");
  });

  it("single shot: no per-module fallback on parse error", async () => {
    let call = 0;
    const extractor = async () => {
      call += 1;
      if (call === 1) {
        return { questions: [], rawText: "not valid json {{{", failureReason: "parse_error" };
      }
      return {
        questions: [makeQuestion("math", 1)],
        rawText: '[{"content":"math m1"}]',
      };
    };
    const result = await runSatSectionExtractPipeline({
      subject: "SAT_FULL_TEST",
      satFormat: "full_test",
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
    assert.equal(result.questions.length, 1);
  });
});
