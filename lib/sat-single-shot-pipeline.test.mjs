import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSatSectionUserPrompt,
  buildSatSingleModuleUserPrompt,
  runSatSingleShotExtract,
} from "./sat-single-shot-pipeline.ts";
import {
  buildSatModuleReport,
  validateSatModuleReport,
} from "./sat-extraction.ts";
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
  if (prompt.includes("SECOND module only")) return counts.m2 ?? 1;
  return 1;
}

function makeBucketQuestions(section, modNum, count, variant = null) {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion(section, modNum, {
      content: `Bucket stem ${modNum}-${variant ?? "m1"}-${i} with enough length for salvage.`,
      image_description: `Passage block ${i} unique content here.`,
      sat_module_variant: variant,
      options: [`OptA${i}`, `OptB${i}`, `OptC${i}`, `OptD${i}`],
    })
  );
}

function sixModuleBucketExtractor(counts) {
  return async (args) => {
    const n = bucketCountFromPrompt(args.userPrompt, counts);
    let modNum = 1;
    let variant = null;
    if (args.userPrompt.includes("EASY path")) {
      modNum = 2;
      variant = "easy";
    } else if (args.userPrompt.includes("HARD path")) {
      modNum = 2;
      variant = "hard";
    } else if (args.userPrompt.includes("SECOND module")) {
      modNum = 2;
    }
    const section = args.userPrompt.includes("Math") ? "math" : "rw";
    return {
      questions: makeBucketQuestions(section, modNum, n, variant),
      rawText: "[]",
    };
  };
}

describe("buildSatSectionUserPrompt six_module", () => {
  it("includes Module A/B hints for adaptive R&W", () => {
    const prompt = buildSatSectionUserPrompt("rw", {
      adaptiveMode: "six_module",
      userModuleCounts: { rw1: 27, rw2easy: 14, rw2hard: 14 },
    });
    assert.ok(prompt.includes("Module A"));
    assert.ok(prompt.includes('sat_module_variant="easy"'));
    assert.ok(prompt.includes('sat_module_variant="hard"'));
    assert.ok(prompt.includes("sat_module_variant=\"hard\""));
    assert.ok(prompt.includes("sat_pdf_module_label"));
    assert.ok(prompt.includes("Required per block"));
    assert.ok(prompt.includes("Expected total for this section: ~55"));
  });
});

describe("buildSatSingleModuleUserPrompt", () => {
  it("targets rw1 count for SAT_RW", () => {
    const prompt = buildSatSingleModuleUserPrompt({
      subject: "SAT_RW",
      userModuleCounts: { rw1: 27 },
      questionCount: null,
    });
    assert.ok(prompt.includes("exactly 27"));
  });
});

describe("runSatSingleShotExtract", () => {
  it("runs exactly one call per section for full test", async () => {
    let call = 0;
    const extractor = async (args) => {
      call += 1;
      const section = call === 1 ? "rw" : "math";
      assert.ok(args.userPrompt.includes(section === "rw" ? "Reading & Writing" : "Math"));
      return {
        questions: [
          makeQuestion(section, 1),
          makeQuestion(section, 2),
        ],
        rawText: "[]",
      };
    };
    const result = await runSatSingleShotExtract({
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
    assert.equal(result.questions.length, 4);
  });

  it("runs three bucket calls for SAT_RW section_test six_module", async () => {
    let call = 0;
    const counts = { m1: 2, m2Easy: 1, m2Hard: 1 };
    const extractor = async (args) => {
      call += 1;
      const n = bucketCountFromPrompt(args.userPrompt, counts);
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
        questions: makeBucketQuestions("rw", modNum, n, variant),
        rawText: "[]",
      };
    };
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: { rw1: 2, rw2easy: 1, rw2hard: 1 },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(call, 3);
    assert.equal(result.questions.length, 4);
    assert.ok(result.questions.some((q) => q.sat_module_variant === "easy"));
    assert.ok(result.questions.some((q) => q.sat_module_variant === "hard"));
  });

  it("six_module per-bucket extract fills rw1 rw2easy rw2hard targets", async () => {
    const userModuleCounts = { rw1: 27, rw2easy: 27, rw2hard: 22 };
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "six_module",
      userModuleCounts,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor: sixModuleBucketExtractor({
        m1: 27,
        m2Easy: 27,
        m2Hard: 22,
      }),
    });
    assert.equal(result.questions.length, 76);
    assert.equal(result.bucketCountsAfterFilter.rw1, 27);
    assert.equal(result.bucketCountsAfterFilter.rw2easy, 27);
    assert.equal(result.bucketCountsAfterFilter.rw2hard, 22);
    const report = buildSatModuleReport(result.questions);
    const validation = validateSatModuleReport(
      report,
      "six_module",
      null,
      "rw",
      { userModuleCounts }
    );
    assert.equal(validation.ok, true);
  });

  it("supplement retry adds questions when first bucket call under-fills", async () => {
    let hardCalls = 0;
    const extractor = async (args) => {
      if (args.userPrompt.includes("HARD path")) {
        hardCalls += 1;
        const count = hardCalls === 1 ? 2 : 20;
        return {
          questions: makeBucketQuestions("rw", 2, count, "hard"),
          rawText: "[]",
        };
      }
      if (args.userPrompt.includes("EASY path")) {
        return { questions: makeBucketQuestions("rw", 2, 27, "easy"), rawText: "[]" };
      }
      return { questions: makeBucketQuestions("rw", 1, 27, null), rawText: "[]" };
    };
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: { rw1: 27, rw2easy: 27, rw2hard: 22 },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(hardCalls, 2);
    assert.ok(result.bucketCountsAfterFilter.rw2hard >= 20);
  });

  it("assigns rw2hard when per-bucket extract returns M2 hard questions", async () => {
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: { rw1: 3, rw2easy: 2, rw2hard: 2 },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor: sixModuleBucketExtractor({ m1: 3, m2Easy: 2, m2Hard: 2 }),
    });
    const hardCount = result.questions.filter(
      (q) => q.sat_module === 2 && q.sat_module_variant === "hard"
    ).length;
    assert.ok(hardCount > 0);
    assert.equal(result.bucketCountsAfterFilter.rw2hard, hardCount);
  });

  it("keeps 27 R&W rows when stems match but passages differ", async () => {
    const sharedStem =
      "Which choice completes the text so that it conforms to the conventions of Standard English?";
    const questions = Array.from({ length: 27 }, (_, i) =>
      makeQuestion("rw", 1, {
        content: sharedStem,
        image_description: `Passage block ${i} with unique content for dedupe fingerprinting.`,
        options: [`Choice A ${i}`, `Choice B ${i}`, `Choice C ${i}`, `Choice D ${i}`],
      })
    );
    const extractor = async () => ({
      questions,
      rawText: "[]",
    });
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "none",
      userModuleCounts: { rw1: 27 },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(result.questions.length, 27);
    assert.equal(result.bucketCountsAfterFilter.rw1, 27);
  });

  it("six_module per-bucket path passes validation with proportional M2 split", async () => {
    const userModuleCounts = { rw1: 27, rw2easy: 27, rw2hard: 23 };
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "six_module",
      userModuleCounts,
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor: sixModuleBucketExtractor({
        m1: 27,
        m2Easy: 27,
        m2Hard: 23,
      }),
    });
    const report = buildSatModuleReport(result.questions);
    assert.equal(report.rw1, 27);
    assert.equal(report.rw2Easy, 27);
    assert.equal(report.rw2Hard, 23);
    const validation = validateSatModuleReport(
      report,
      "six_module",
      null,
      "rw",
      { userModuleCounts }
    );
    assert.equal(validation.ok, true);
    assert.ok(!(validation.emptyBucketKeys?.length));
  });

  it("returns MODEL_EMPTY_ARRAY on intentional empty array", async () => {
    const extractor = async () => ({
      questions: [],
      rawText: "[]",
      failureReason: "valid_array",
    });
    const result = await runSatSingleShotExtract({
      subject: "SAT_RW",
      satFormat: "section_test",
      sectionFilter: "rw",
      effectiveAdaptiveMode: "none",
      userModuleCounts: { rw1: 27, rw2: 27 },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });
    assert.equal(result.questions.length, 0);
    assert.equal(result.extractionErrorCode, "MODEL_EMPTY_ARRAY");
  });

  it("six_module full test dedupes cross-bucket overlap from duplicate extractions", async () => {
    const duplicateStem =
      "Which choice completes the text so that it conforms to grammar rules here?";
    const bleedQuestion = {
      type: "text",
      content: duplicateStem,
      image_description: "Shared passage block for full test overlap simulation.",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      question_type: "mcq",
      correct: "A",
      accepted_answers: null,
      sat_pdf_module_label: "Module 1",
    };

    const extractor = async (args) => {
      const section = args.userPrompt.includes("Math") ? "math" : "rw";
      const n = bucketCountFromPrompt(args.userPrompt, {
        m1: 2,
        m2Easy: 2,
        m2Hard: 1,
      });
      let modNum = 1;
      let variant = null;
      if (args.userPrompt.includes("EASY path")) {
        modNum = 2;
        variant = "easy";
      } else if (args.userPrompt.includes("HARD path")) {
        modNum = 2;
        variant = "hard";
      }
      const questions = makeBucketQuestions(section, modNum, n, variant);
      if (
        section === "math" &&
        (args.userPrompt.includes("FIRST module only") ||
          args.userPrompt.includes("EASY path"))
      ) {
        return {
          questions: [...questions, { ...bleedQuestion }],
          rawText: "[]",
        };
      }
      return { questions, rawText: "[]" };
    };

    const result = await runSatSingleShotExtract({
      subject: "SAT_FULL_TEST",
      satFormat: "full_test",
      sectionFilter: null,
      effectiveAdaptiveMode: "six_module",
      userModuleCounts: {
        rw1: 2,
        rw2easy: 2,
        rw2hard: 1,
        math1: 2,
        math2easy: 2,
        math2hard: 1,
      },
      systemInstruction: "sys",
      apiKey: "test-key",
      pdfPart: { text: "fake" },
      tracker: null,
      extractor,
    });

    const mathDupes = result.questions.filter(
      (q) => q.sat_section === "math" && q.content === duplicateStem
    );
    assert.equal(mathDupes.length, 1);
    assert.equal(mathDupes[0].sat_module, 1);
  });

  it("does not retry when first section call returns zero", async () => {
    let call = 0;
    const extractor = async () => {
      call += 1;
      if (call === 1) return { questions: [], rawText: "[]", failureReason: "parse_error" };
      return {
        questions: [makeQuestion("math", 1)],
        rawText: "[]",
      };
    };
    const result = await runSatSingleShotExtract({
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
