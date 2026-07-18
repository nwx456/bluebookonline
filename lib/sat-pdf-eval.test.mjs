import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEvalContext,
  createMockSatExtractor,
  evaluatePipelineResult,
  parseEvalCliArgs,
  runEvalExtraction,
} from "./sat-pdf-eval.ts";
import { runSatSectionExtractPipeline } from "./sat-extract-pipeline.ts";

describe("parseEvalCliArgs", () => {
  it("parses required flags", () => {
    const args = parseEvalCliArgs([
      "--pdf",
      "./fixtures/sat/rw-practice.pdf",
      "--subject",
      "SAT_RW",
      "--format",
      "single_module",
      "--adaptive",
      "none",
      "--module-counts",
      '{"rw1":27}',
    ]);
    assert.equal(args.pdf, "./fixtures/sat/rw-practice.pdf");
    assert.equal(args.subject, "SAT_RW");
    assert.equal(args.format, "single_module");
    assert.equal(args.adaptive, "none");
    assert.equal(args.moduleCounts?.rw1, 27);
    assert.equal(args.mock, true);
    assert.equal(args.live, false);
  });

  it("sets live mode when --live is passed", () => {
    const args = parseEvalCliArgs([
      "--pdf",
      "test.pdf",
      "--live",
    ]);
    assert.equal(args.live, true);
    assert.equal(args.mock, false);
  });

  it("throws when --pdf is missing", () => {
    assert.throws(() => parseEvalCliArgs(["--subject", "SAT_RW"]), /--pdf is required/);
  });
});

describe("buildEvalContext", () => {
  it("scopes SAT_RW to rw section", () => {
    const ctx = buildEvalContext(
      parseEvalCliArgs([
        "--pdf",
        "x.pdf",
        "--subject",
        "SAT_RW",
        "--format",
        "section_test",
      ])
    );
    assert.equal(ctx.sectionFilter, "rw");
    assert.equal(ctx.usesSectionPipeline, true);
    assert.ok(ctx.userModuleCounts?.rw1);
  });
});

describe("evaluatePipelineResult", () => {
  const baseOpts = {
    subject: "SAT_RW",
    satFormat: "single_module",
    effectiveAdaptiveMode: "none",
    sectionFilter: "rw",
    userModuleCounts: { rw1: 27 },
    mode: "mock",
  };

  const goodQuestion = {
    type: "text",
    content: "Sample stem long enough for validation checks here.",
    image_description: "Passage",
    options: ["A", "B", "C", "D"],
    question_type: "mcq",
    correct: "A",
    accepted_answers: null,
    sat_section: "rw",
    sat_module: 1,
    sat_module_variant: null,
    sat_difficulty: null,
  };

  it("passes SAT_RW single_module with valid questions", () => {
    const result = evaluatePipelineResult(
      { questions: [goodQuestion] },
      baseOpts,
      100
    );
    assert.equal(result.ok, true);
    assert.equal(result.phase, "done");
    assert.equal(result.questionCount, 1);
  });

  it("fails on MODEL_EMPTY_ARRAY", () => {
    const result = evaluatePipelineResult(
      {
        questions: [],
        extractionErrorCode: "MODEL_EMPTY_ARRAY",
        extractionError: "empty",
      },
      baseOpts,
      50
    );
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "MODEL_EMPTY_ARRAY");
    assert.ok(result.hints.length > 0);
  });

  it("fails section_test when rw2 bucket is empty", () => {
    const result = evaluatePipelineResult(
      {
        questions: [
          { ...goodQuestion, sat_module: 1 },
        ],
      },
      {
        ...baseOpts,
        satFormat: "section_test",
        userModuleCounts: { rw1: 27, rw2: 27 },
      },
      80
    );
    assert.equal(result.ok, false);
    assert.equal(result.phase, "validate");
    assert.ok(result.emptyBucketKeys.includes("rw2"));
  });
});

describe("mock extractor pipeline", () => {
  it("produces passing eval for SAT_RW single_module", async () => {
    const ctx = buildEvalContext(
      parseEvalCliArgs([
        "--pdf",
        "mock.pdf",
        "--subject",
        "SAT_RW",
        "--format",
        "single_module",
        "--module-counts",
        '{"rw1":27}',
      ])
    );
    const input = await runEvalExtraction({
      ctx,
      pdfPart: { text: "mock" },
      apiKey: "test",
      mode: "mock",
    });
    const evalResult = evaluatePipelineResult(
      input,
      {
        subject: ctx.subject,
        satFormat: ctx.resolvedSatFormat,
        effectiveAdaptiveMode: ctx.effectiveAdaptiveMode,
        sectionFilter: ctx.sectionFilter,
        userModuleCounts: ctx.userModuleCounts,
        mode: "mock",
      },
      200
    );
    assert.equal(evalResult.ok, true);
    assert.ok(evalResult.questionCount >= 1);
  });

  it("produces passing eval for SAT_RW section_test", async () => {
    const ctx = buildEvalContext(
      parseEvalCliArgs([
        "--pdf",
        "mock.pdf",
        "--subject",
        "SAT_RW",
        "--format",
        "section_test",
        "--module-counts",
        '{"rw1":27,"rw2":27}',
      ])
    );
    const extractor = createMockSatExtractor(ctx);
    const pipeline = await runSatSectionExtractPipeline({
      subject: ctx.subject,
      satFormat: ctx.resolvedSatFormat,
      sectionFilter: ctx.sectionFilter,
      effectiveAdaptiveMode: ctx.effectiveAdaptiveMode,
      userModuleCounts: ctx.userModuleCounts,
      systemInstruction: "sys",
      apiKey: "test",
      pdfPart: { text: "mock" },
      tracker: null,
      extractor,
    });
    const evalResult = evaluatePipelineResult(
      {
        questions: pipeline.questions,
        extractionErrorCode: pipeline.extractionErrorCode,
        extractionError: pipeline.extractionError,
      },
      {
        subject: ctx.subject,
        satFormat: ctx.resolvedSatFormat,
        effectiveAdaptiveMode: ctx.effectiveAdaptiveMode,
        sectionFilter: ctx.sectionFilter,
        userModuleCounts: ctx.userModuleCounts,
        mode: "mock",
      },
      300
    );
    assert.equal(evalResult.ok, true);
    assert.ok(evalResult.moduleReport.rw1 > 0);
    assert.ok(evalResult.moduleReport.rw2 > 0);
  });
});
