import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getModuleDisplayNumber,
  getSatModuleGroups,
  sameSatModuleBucket,
} from "./sat-question-display.ts";

describe("sameSatModuleBucket", () => {
  it("matches section module and variant for M2", () => {
    const a = { question_number: 1, sat_section: "rw", sat_module: 2, sat_module_variant: "easy" };
    const b = { question_number: 2, sat_section: "rw", sat_module: 2, sat_module_variant: "easy" };
    const c = { question_number: 3, sat_section: "rw", sat_module: 2, sat_module_variant: "hard" };
    assert.equal(sameSatModuleBucket(a, b), true);
    assert.equal(sameSatModuleBucket(a, c), false);
  });
});

describe("getModuleDisplayNumber", () => {
  it("returns 1-based index within module not global number", () => {
    const qs = [
      { question_number: 1, sat_section: "rw", sat_module: 1 },
      { question_number: 50, sat_section: "rw", sat_module: 1 },
      { question_number: 100, sat_section: "math", sat_module: 1 },
    ];
    assert.equal(getModuleDisplayNumber(qs, qs[1]), 2);
    assert.equal(getModuleDisplayNumber(qs, qs[2]), 1);
  });
});

describe("getSatModuleGroups", () => {
  it("splits six_module M2 by variant", () => {
    const qs = [
      { question_number: 1, sat_section: "rw", sat_module: 1 },
      { question_number: 2, sat_section: "rw", sat_module: 2, sat_module_variant: "easy" },
      { question_number: 3, sat_section: "rw", sat_module: 2, sat_module_variant: "hard" },
    ];
    const groups = getSatModuleGroups(qs, "SAT_FULL_TEST");
    assert.equal(groups.length, 3);
    assert.ok(groups.some((g) => g.id === "rw2-easy"));
    assert.ok(groups.some((g) => g.id === "rw2-hard"));
  });

  it("single RW upload is one group", () => {
    const qs = [{ question_number: 5, sat_section: "rw", sat_module: 1 }];
    const groups = getSatModuleGroups(qs, "SAT_RW");
    assert.equal(groups.length, 1);
    assert.equal(groups[0].shortLabel, "R&W");
  });

  it("section_test none RW splits M1 and M2", () => {
    const qs = [
      { question_number: 1, sat_section: "rw", sat_module: 1 },
      { question_number: 2, sat_section: "rw", sat_module: 2 },
    ];
    const groups = getSatModuleGroups(qs, "SAT_RW", {
      satFormat: "section_test",
      satAdaptiveMode: "none",
    });
    assert.equal(groups.length, 2);
    assert.ok(groups.some((g) => g.id === "rw1"));
    assert.ok(groups.some((g) => g.id === "rw2"));
  });

  it("section_test six_module RW splits by module variant", () => {
    const qs = [
      { question_number: 1, sat_section: "rw", sat_module: 1 },
      { question_number: 2, sat_section: "rw", sat_module: 2, sat_module_variant: "easy" },
      { question_number: 3, sat_section: "rw", sat_module: 2, sat_module_variant: "hard" },
    ];
    const groups = getSatModuleGroups(qs, "SAT_RW", {
      satFormat: "section_test",
      satAdaptiveMode: "six_module",
    });
    assert.equal(groups.length, 3);
    assert.ok(groups.some((g) => g.id === "rw1"));
    assert.ok(groups.some((g) => g.id === "rw2-easy"));
    assert.ok(groups.some((g) => g.id === "rw2-hard"));
  });
});
