import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterQuestionsForSatModule } from "./exam-grade.ts";

function makeQ(overrides = {}) {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    question_number: 1,
    question_text: "Sample",
    passage_text: null,
    option_a: "A",
    option_b: "B",
    option_c: "C",
    option_d: "D",
    option_e: null,
    correct_answer: "A",
    sat_section: null,
    sat_module: null,
    sat_module_variant: null,
    ...overrides,
  };
}

describe("filterQuestionsForSatModule strict matching", () => {
  const baseOpts = {
    isSatFull: true,
    satAdaptiveMode: "none",
    selectedRwM2Variant: null,
    selectedMathM2Variant: null,
  };

  it("returns questions unchanged when isSatFull is false", () => {
    const qs = [makeQ({ sat_section: null }), makeQ({ sat_section: "rw", sat_module: 1 })];
    const result = filterQuestionsForSatModule(qs, "rw1", {
      ...baseOpts,
      isSatFull: false,
    });
    assert.equal(result.length, 2);
  });

  it("drops questions with missing sat_section (no fallback to rw)", () => {
    const qs = [
      makeQ({ sat_section: null, sat_module: 1 }),
      makeQ({ sat_section: "rw", sat_module: 1 }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw1", baseOpts);
    assert.equal(result.length, 1);
  });

  it("drops questions with missing sat_module (no fallback to 1)", () => {
    const qs = [
      makeQ({ sat_section: "rw", sat_module: null }),
      makeQ({ sat_section: "rw", sat_module: 1 }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw1", baseOpts);
    assert.equal(result.length, 1);
  });

  it("filters to only rw1 questions", () => {
    const qs = [
      makeQ({ sat_section: "rw", sat_module: 1 }),
      makeQ({ sat_section: "rw", sat_module: 2 }),
      makeQ({ sat_section: "math", sat_module: 1 }),
      makeQ({ sat_section: "math", sat_module: 2 }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw1", baseOpts);
    assert.equal(result.length, 1);
    assert.equal(result[0].sat_section, "rw");
    assert.equal(result[0].sat_module, 1);
  });

  it("in six_module M2 requires exact variant match; missing variant is dropped", () => {
    const qs = [
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: "easy" }),
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: "hard" }),
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: null }),
    ];
    const easy = filterQuestionsForSatModule(qs, "rw2", {
      ...baseOpts,
      satAdaptiveMode: "six_module",
      selectedRwM2Variant: "easy",
    });
    assert.equal(easy.length, 1);
    assert.equal(easy[0].sat_module_variant, "easy");
  });

  it("in six_module with no selected variant, all M2 questions are dropped", () => {
    const qs = [
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: "easy" }),
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: "hard" }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw2", {
      ...baseOpts,
      satAdaptiveMode: "six_module",
      selectedRwM2Variant: null,
    });
    assert.equal(result.length, 0);
  });

  it("accepts uppercase / whitespace in sat_section", () => {
    const qs = [
      makeQ({ sat_section: "RW", sat_module: 1 }),
      makeQ({ sat_section: " math ", sat_module: 2 }),
    ];
    const rw = filterQuestionsForSatModule(qs, "rw1", baseOpts);
    assert.equal(rw.length, 1);
    const math = filterQuestionsForSatModule(qs, "math2", baseOpts);
    assert.equal(math.length, 1);
  });

  it("non-adaptive mode: M2 with variant is still included in rw2", () => {
    const qs = [
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: "hard" }),
      makeQ({ sat_section: "rw", sat_module: 2, sat_module_variant: null }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw2", baseOpts);
    assert.equal(result.length, 2);
  });

  it("rejects strings other than rw/math for sat_section", () => {
    const qs = [
      makeQ({ sat_section: "reading", sat_module: 1 }),
      makeQ({ sat_section: "english", sat_module: 1 }),
    ];
    const result = filterQuestionsForSatModule(qs, "rw1", baseOpts);
    assert.equal(result.length, 0);
  });

  it("returns empty when moduleId is invalid", () => {
    const qs = [makeQ({ sat_section: "rw", sat_module: 1 })];
    const result = filterQuestionsForSatModule(qs, "not_a_module", baseOpts);
    assert.equal(result.length, 0);
  });
});
