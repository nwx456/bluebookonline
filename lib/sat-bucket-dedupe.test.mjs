import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dedupeSatBucketQuestions,
  dedupeSatSectionCrossBucketQuestions,
} from "./sat-bucket-dedupe.ts";

const SHARED_STEM =
  "Which choice completes the text so that it conforms to the conventions of Standard English?";

describe("dedupeSatBucketQuestions", () => {
  it("keeps same stem in different module buckets (M1 vs M2 easy)", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea?",
        image_description: "Passage one.",
        options: ["A text", "B text", "C text", "D text"],
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "easy",
        content: "Which choice best states the main idea?",
        image_description: "Passage one.",
        options: ["A text", "B text", "C text", "D text"],
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "hard",
        content: "What is the purpose of paragraph 2?",
        image_description: "Passage two.",
        options: ["A text", "B text", "C text", "D text"],
      },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 3);
    assert.equal(out[0].sat_module, 1);
    assert.equal(out[1].sat_module, 2);
    assert.equal(out[1].sat_module_variant, "easy");
  });

  it("removes true duplicates (same stem, passage, and options) within bucket", () => {
    const row = {
      sat_section: "rw",
      sat_module: 1,
      content: "Which choice best states the main idea?",
      image_description: "Shared passage text for duplicate detection.",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
    };
    const out = dedupeSatBucketQuestions([row, { ...row }]);
    assert.equal(out.length, 1);
  });

  it("keeps same stem with different passages in the same bucket", () => {
    const qs = Array.from({ length: 27 }, (_, i) => ({
      sat_section: "rw",
      sat_module: 1,
      content: SHARED_STEM,
      image_description: `Unique passage excerpt number ${i} with enough text to distinguish rows.`,
      options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`],
    }));
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 27);
  });

  it("keeps questions in different sections", () => {
    const qs = [
      { sat_section: "rw", content: "Same stem text here for rw" },
      { sat_section: "math", content: "Same stem text here for rw" },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 2);
  });

  it("keeps similar but distinct stems in the same bucket", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea of paragraph one?",
      },
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea of paragraph two?",
      },
    ];
    const out = dedupeSatBucketQuestions(qs);
    assert.equal(out.length, 2);
  });

  it("dedupes math rows with same stem and options", () => {
    const row = {
      sat_section: "math",
      sat_module: 1,
      content: "What is the value of x in the equation shown?",
      options: ["1", "2", "3", "4"],
    };
    const out = dedupeSatBucketQuestions([row, { ...row }]);
    assert.equal(out.length, 1);
  });
});

describe("dedupeSatSectionCrossBucketQuestions", () => {
  const sharedStem =
    "Which choice completes the text so that it conforms to Standard English rules?";

  it("collapses same stem+passage across rw1 and rw2easy keeping M1 label", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        sat_module_variant: null,
        sat_pdf_module_label: "Module 1",
        content: sharedStem,
        image_description: "Shared passage for cross-bucket duplicate detection.",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "easy",
        sat_pdf_module_label: "Module 1",
        content: sharedStem,
        image_description: "Shared passage for cross-bucket duplicate detection.",
        options: ["Alpha", "Beta", "Gamma", "Delta"],
      },
    ];
    const { kept, dropped } = dedupeSatSectionCrossBucketQuestions(qs);
    assert.equal(kept.length, 1);
    assert.equal(dropped, 1);
    assert.equal(kept[0].sat_module, 1);
    assert.equal(kept[0].sat_module_variant, null);
  });

  it("keeps distinct questions in different buckets", () => {
    const qs = [
      {
        sat_section: "rw",
        sat_module: 1,
        content: "Which choice best states the main idea of paragraph one?",
        image_description: "Passage one unique text.",
        options: ["A1", "B1", "C1", "D1"],
      },
      {
        sat_section: "rw",
        sat_module: 2,
        sat_module_variant: "easy",
        content: "What is the purpose of paragraph two in this excerpt?",
        image_description: "Passage two unique text.",
        options: ["A2", "B2", "C2", "D2"],
      },
    ];
    const { kept, dropped } = dedupeSatSectionCrossBucketQuestions(qs);
    assert.equal(kept.length, 2);
    assert.equal(dropped, 0);
  });
});
