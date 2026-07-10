import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dedupeSatBucketQuestions } from "./sat-bucket-dedupe.ts";

describe("dedupeSatBucketQuestions", () => {
  it("keeps same stem in different module buckets (M1 vs M2 easy)", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea?",
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "easy",
        content: "Which choice best states the main idea?",
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "hard",
        content: "What is the purpose of paragraph 2?",
      },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 3);
    assert.equal(out[0].sat_module, 1);
    assert.equal(out[1].sat_module, 2);
    assert.equal(out[1].sat_module_variant, "easy");
  });

  it("removes duplicate stems within the same bucket", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea?",
      },
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea?",
      },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 1);
  });

  it("keeps questions in different sections", () => {
    const qs = [
      { sat_section: "rw", content: "Same stem text here for rw" },
      { sat_section: "math", content: "Same stem text here for rw" },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 2);
  });
});
