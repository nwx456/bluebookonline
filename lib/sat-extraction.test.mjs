import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSatExtractionPlan,
  bucketExtractionNeedsRetry,
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
