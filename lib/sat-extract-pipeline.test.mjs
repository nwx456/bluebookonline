import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSatBucketExtractPipeline } from "./sat-extract-pipeline.ts";

function makeQuestion(overrides = {}) {
  return {
    type: "text",
    content: `Sample stem ${Math.random().toString(36).slice(2)} that is long enough to survive salvage.`,
    image_description: "Sample passage or figure description.",
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    question_type: "mcq",
    correct: "A",
    accepted_answers: null,
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

describe("runSatBucketExtractPipeline", () => {
  it("runs one call per bucket in non-adaptive full test (4 buckets)", async () => {
    const seenPrompts = [];
    let call = 0;
    const extractor = async (args) => {
      seenPrompts.push(args.userPrompt);
      call += 1;
      return {
        questions: [
          makeQuestion(),
          makeQuestion(),
          makeQuestion(),
        ],
        rawText: "[]",
      };
    };
    const result = await runSatBucketExtractPipeline({
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
    assert.equal(call, 4);
    assert.equal(seenPrompts.length, 4);
    assert.equal(result.questions.length, 12);
    // Every question must have a section + module (bucket forces this).
    for (const q of result.questions) {
      assert.ok(q.sat_section === "rw" || q.sat_section === "math");
      assert.ok(q.sat_module === 1 || q.sat_module === 2);
    }
  });

  it("runs 6 calls in six_module full test", async () => {
    let call = 0;
    const extractor = async () => {
      call += 1;
      return {
        questions: [makeQuestion(), makeQuestion()],
        rawText: "[]",
      };
    };
    await runSatBucketExtractPipeline({
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
    assert.equal(call, 6);
  });

  it("retries once when the first call returns zero", async () => {
    const extractor = mockExtractor([
      // rw1 first attempt: empty
      { questions: [], rawText: "[]" },
      // rw1 retry: 3 questions
      { questions: [makeQuestion(), makeQuestion(), makeQuestion()], rawText: "[]" },
      // rw2 first attempt: has content
      { questions: [makeQuestion(), makeQuestion()], rawText: "[]" },
      // math1 first attempt: has content
      { questions: [makeQuestion()], rawText: "[]" },
      // math2 first attempt: has content
      { questions: [makeQuestion()], rawText: "[]" },
    ]);
    const result = await runSatBucketExtractPipeline({
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
    // rw1 retried and recovered 3
    const rw1 = result.questions.filter(
      (q) => q.sat_section === "rw" && q.sat_module === 1
    );
    assert.equal(rw1.length, 3);
  });

  it("keeps bucket empty (no throw) when both attempts return zero", async () => {
    const extractor = async () => ({ questions: [], rawText: "[]" });
    const result = await runSatBucketExtractPipeline({
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

  it("respects section filter (only rw buckets)", async () => {
    let call = 0;
    const extractor = async () => {
      call += 1;
      return {
        questions: [makeQuestion()],
        rawText: "[]",
      };
    };
    await runSatBucketExtractPipeline({
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
    assert.equal(call, 2);
  });
});
