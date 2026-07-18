import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSatExtractionPlan,
  bucketExtractionNeedsRetry,
  bucketNeedsSupplementalExtract,
  buildSatModuleExtractionPrompt,
  splitSectionQuestionsIntoBuckets,
  validateSatModuleReport,
} from "./sat-extraction.ts";

describe("validateSatModuleReport empty bucket detection", () => {
  it("fails when R&W M2 easy/hard are both empty in six_module", () => {
    const report = {
      rw1: 27,
      rw2: 0,
      rw2Easy: 0,
      rw2Hard: 0,
      math1: 0,
      math2: 0,
      math2Easy: 0,
      math2Hard: 0,
    };
    const result = validateSatModuleReport(report, "six_module", null, "rw");
    assert.equal(result.ok, false);
    assert.ok(result.emptyBucketKeys?.includes("rw2Easy"));
    assert.ok(result.emptyBucketKeys?.includes("rw2Hard"));
  });

  it("passes when all six_module R&W buckets have questions", () => {
    const report = {
      rw1: 27,
      rw2: 54,
      rw2Easy: 27,
      rw2Hard: 27,
      math1: 0,
      math2: 0,
      math2Easy: 0,
      math2Hard: 0,
    };
    const result = validateSatModuleReport(report, "six_module", null, "rw");
    assert.equal(result.ok, true);
  });

  it("passes short PDF where every non-adaptive bucket has at least 1 question", () => {
    const report = {
      rw1: 5,
      rw2: 3,
      rw2Easy: 0,
      rw2Hard: 0,
      math1: 4,
      math2: 2,
      math2Easy: 0,
      math2Hard: 0,
    };
    const result = validateSatModuleReport(report, "none");
    assert.equal(result.ok, true);
  });
});

describe("validateSatModuleReport user module counts", () => {
  it("warns but does not fail when below user target (16/27)", () => {
    const report = {
      rw1: 16,
      rw2: 18,
      rw2Easy: 9,
      rw2Hard: 12,
      math1: 0,
      math2: 0,
      math2Easy: 0,
      math2Hard: 0,
    };
    const userCounts = { rw1: 27, rw2easy: 27, rw2hard: 27 };
    const result = validateSatModuleReport(report, "six_module", null, "rw", {
      userModuleCounts: userCounts,
    });
    assert.equal(result.ok, true);
    assert.ok(result.warnings?.length > 0);
    assert.ok(result.warnings.some((w) => w.includes("rw1: 16/27")));
  });

  it("fails when a target bucket returns zero", () => {
    const report = {
      rw1: 0,
      rw2: 0,
      rw2Easy: 0,
      rw2Hard: 0,
      math1: 0,
      math2: 0,
      math2Easy: 0,
      math2Hard: 0,
    };
    const userCounts = { rw1: 27 };
    const result = validateSatModuleReport(report, "none", null, "rw", {
      userModuleCounts: userCounts,
    });
    assert.equal(result.ok, false);
    assert.ok(result.emptyBucketKeys?.includes("rw1"));
  });

  it("fails when a bucket over-extracts more than 2x expected", () => {
    const report = {
      rw1: 200,
      rw2: 0,
      rw2Easy: 0,
      rw2Hard: 0,
      math1: 0,
      math2: 0,
      math2Easy: 0,
      math2Hard: 0,
    };
    const userCounts = { rw1: 27 };
    const result = validateSatModuleReport(report, "none", null, "rw", {
      userModuleCounts: userCounts,
    });
    assert.equal(result.ok, false);
    assert.ok(result.overfullBucketKeys?.includes("rw1"));
  });

  it("fails when a bucket exceeds expected + supplement gap (38/27)", () => {
    const report = {
      rw1: 27,
      rw2: 0,
      rw2Easy: 27,
      rw2Hard: 22,
      math1: 22,
      math2: 0,
      math2Easy: 38,
      math2Hard: 22,
    };
    const userCounts = { math2easy: 27 };
    const result = validateSatModuleReport(report, "six_module", null, null, {
      userModuleCounts: userCounts,
    });
    assert.equal(result.ok, false);
    assert.ok(result.overfullBucketKeys?.includes("math2easy"));
  });
});

describe("buildSatExtractionPlan expectedCount", () => {
  it("uses default SAT module counts when no user counts", () => {
    const plan = buildSatExtractionPlan("none", "rw");
    assert.equal(plan.length, 2);
    assert.equal(plan[0].expectedCount, 27);
    assert.equal(plan[1].expectedCount, 27);
  });

  it("uses user counts when provided", () => {
    const plan = buildSatExtractionPlan("six_module", "rw", {
      rw1: 22,
      rw2easy: 22,
      rw2hard: 22,
    });
    assert.equal(plan.length, 3);
    assert.equal(plan[0].expectedCount, 22);
    assert.equal(plan[1].expectedCount, 22);
    assert.equal(plan[2].expectedCount, 22);
  });

  it("returns 4 buckets in non-adaptive full test", () => {
    const plan = buildSatExtractionPlan("none");
    assert.equal(plan.length, 4);
    assert.deepEqual(
      plan.map((b) => `${b.section}${b.module}`),
      ["rw1", "rw2", "math1", "math2"]
    );
  });

  it("returns 6 buckets in six_module full test", () => {
    const plan = buildSatExtractionPlan("six_module");
    assert.equal(plan.length, 6);
    const keys = plan.map((b) => `${b.section}${b.module}${b.variant ?? ""}`);
    assert.deepEqual(keys, [
      "rw1",
      "rw2easy",
      "rw2hard",
      "math1",
      "math2easy",
      "math2hard",
    ]);
  });
});

describe("bucketExtractionNeedsRetry", () => {
  it("retries when count is zero", () => {
    assert.equal(bucketExtractionNeedsRetry(0), true);
  });

  it("does not retry when count is >= 1", () => {
    assert.equal(bucketExtractionNeedsRetry(1), false);
    assert.equal(bucketExtractionNeedsRetry(27), false);
    assert.equal(bucketExtractionNeedsRetry(100), false);
  });
});

describe("bucketNeedsSupplementalExtract", () => {
  it("returns true when bucket is empty", () => {
    assert.equal(bucketNeedsSupplementalExtract(0, 27), true);
  });

  it("returns true when far below expected", () => {
    assert.equal(bucketNeedsSupplementalExtract(2, 27), true);
    assert.equal(bucketNeedsSupplementalExtract(21, 27), true);
  });

  it("returns false when within supplement gap", () => {
    assert.equal(bucketNeedsSupplementalExtract(22, 27), false);
    assert.equal(bucketNeedsSupplementalExtract(27, 27), false);
  });
});

describe("buildSatModuleExtractionPrompt", () => {
  it("includes full test cross-section hint when isFullTestPdf", () => {
    const plan = buildSatExtractionPlan("six_module", "math");
    const math1 = plan.find((b) => b.section === "math" && b.module === 1);
    const prompt = buildSatModuleExtractionPrompt(math1, {
      adaptiveMode: "six_module",
      isFullTestPdf: true,
    });
    assert.ok(prompt.includes("FULL TEST"));
    assert.ok(prompt.includes("Reading & Writing"));
    assert.ok(prompt.includes("Do NOT re-extract"));
  });
});

describe("splitSectionQuestionsIntoBuckets", () => {
  it("splits by sat_module tags in non-adaptive mode", () => {
    const questions = [
      { content: "q1", sat_module: 1 },
      { content: "q2", sat_module: 2 },
      { content: "q3", sat_module: 2 },
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "none");
    assert.equal(buckets[0].questions.length, 1);
    assert.equal(buckets[1].questions.length, 2);
    assert.equal(buckets[0].questions[0].sat_section, "rw");
    assert.equal(buckets[0].questions[0].sat_module, 1);
  });

  it("infers module from sat_pdf_module_label when tag missing", () => {
    const questions = [
      { content: "q1", sat_pdf_module_label: "Module 1" },
      { content: "q2", sat_pdf_module_label: "Module 2" },
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "math", "none");
    assert.equal(buckets[0].questions.length, 1);
    assert.equal(buckets[1].questions.length, 1);
    assert.equal(buckets[1].questions[0].sat_module, 2);
  });

  it("propagates last module via state machine when tags missing", () => {
    const questions = [
      { content: "q1", sat_module: 1 },
      { content: "q2" },
      { content: "q3" },
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "none");
    assert.equal(buckets[0].questions.length, 3);
    for (const q of buckets[0].questions) {
      assert.equal(q.sat_module, 1);
    }
  });

  it("splits easy/hard variants in six_module mode", () => {
    const questions = [
      { content: "m1", sat_module: 1 },
      { content: "easy", sat_module: 2, sat_module_variant: "easy" },
      { content: "hard", sat_module: 2, sat_module_variant: "hard" },
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "six_module");
    assert.equal(buckets[0].questions.length, 1);
    assert.equal(buckets[1].questions.length, 1);
    assert.equal(buckets[2].questions.length, 1);
    assert.equal(buckets[1].questions[0].sat_module_variant, "easy");
    assert.equal(buckets[2].questions[0].sat_module_variant, "hard");
  });

  it("splits M2 null variants positionally using userModuleCounts", () => {
    const questions = [
      ...Array.from({ length: 27 }, (_, i) => ({ content: `m1-${i}`, sat_module: 1 })),
      ...Array.from({ length: 27 }, (_, i) => ({ content: `m2-${i}`, sat_module: 2 })),
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "six_module", {
      userModuleCounts: { rw1: 27, rw2easy: 14, rw2hard: 13 },
    });
    assert.equal(buckets[0].questions.length, 27);
    assert.equal(buckets[1].questions.length, 14);
    assert.equal(buckets[2].questions.length, 13);
    assert.equal(buckets[1].questions[0].sat_module_variant, "easy");
    assert.equal(buckets[2].questions[0].sat_module_variant, "hard");
  });

  it("splits 14 M2 null variants proportionally so hard bucket is non-empty", () => {
    const questions = [
      ...Array.from({ length: 27 }, (_, i) => ({ content: `m1-${i}`, sat_module: 1 })),
      ...Array.from({ length: 14 }, (_, i) => ({ content: `m2-${i}`, sat_module: 2 })),
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "six_module", {
      userModuleCounts: { rw1: 27, rw2easy: 27, rw2hard: 23 },
    });
    assert.equal(buckets[0].questions.length, 27);
    assert.ok(buckets[2].questions.length > 0);
    assert.equal(
      buckets[1].questions.length + buckets[2].questions.length,
      14
    );
  });

  it("rebalances when Gemini tags all M2 as easy", () => {
    const questions = [
      { content: "m1", sat_module: 1 },
      ...Array.from({ length: 14 }, (_, i) => ({
        content: `easy-tagged-${i}`,
        sat_module: 2,
        sat_module_variant: "easy",
      })),
    ];
    const { buckets, m2RebalanceMoved } = splitSectionQuestionsIntoBuckets(
      questions,
      "rw",
      "six_module",
      { userModuleCounts: { rw1: 27, rw2easy: 27, rw2hard: 23 } }
    );
    assert.ok(m2RebalanceMoved > 0);
    assert.ok(buckets[2].questions.length > 0);
    assert.equal(
      buckets[1].questions.length + buckets[2].questions.length,
      14
    );
  });

  it("infers hard variant from content when sat_pdf_module_label is empty", () => {
    const questions = [
      { content: "m1", sat_module: 1 },
      { content: "Module B question stem", sat_module: 2 },
    ];
    const { buckets } = splitSectionQuestionsIntoBuckets(questions, "rw", "six_module");
    assert.equal(buckets[2].questions.length, 1);
    assert.equal(buckets[2].questions[0].sat_module_variant, "hard");
  });
});
