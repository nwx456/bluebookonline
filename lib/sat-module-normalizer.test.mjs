/**
 * Unit tests for SAT module label normalizer.
 * Run: node --test lib/sat-module-normalizer.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSatExtractionPlan,
  buildSatModuleReport,
  formatSatModuleReport,
  parseStructureDiscovery,
  validateSatModuleReport,
} from "./sat-extraction.ts";
import {
  inferModuleNumberFromLabel,
  inferVariantFromLabel,
  normalizeLabelForMatch,
} from "./sat-module-normalizer.ts";

describe("inferVariantFromLabel", () => {
  it("maps Module A to easy", () => {
    assert.equal(inferVariantFromLabel("Reading and Writing Module A"), "easy");
  });
  it("maps Module B to hard", () => {
    assert.equal(inferVariantFromLabel("Math Module B"), "hard");
  });
  it("maps Easy/Hard explicitly", () => {
    assert.equal(inferVariantFromLabel("Module 2 — Easy"), "easy");
    assert.equal(inferVariantFromLabel("Above the bar"), "hard");
  });
  it("returns null for Module 1", () => {
    assert.equal(inferVariantFromLabel("Module 1"), null);
  });
});

describe("inferModuleNumberFromLabel", () => {
  it("maps Module 1", () => {
    assert.equal(inferModuleNumberFromLabel("Section 1 Module 1"), 1);
  });
  it("maps Module B to 2 via variant", () => {
    assert.equal(inferModuleNumberFromLabel("Module B"), 2);
  });
});

describe("multilingual labels", () => {
  it("strips diacritics for Spanish Módulo", () => {
    assert.equal(normalizeLabelForMatch("Módulo 1"), "modulo 1");
    assert.equal(inferModuleNumberFromLabel("Lectura y Escritura — Módulo A"), 2);
    assert.equal(inferVariantFromLabel("Lectura y Escritura — Módulo A"), "easy");
  });

  it("maps German Modul 1", () => {
    assert.equal(inferModuleNumberFromLabel("Modul 1: Mathematik"), 1);
    assert.equal(inferVariantFromLabel("Modul B"), "hard");
  });

  it("maps French Module facile/difficile", () => {
    assert.equal(inferVariantFromLabel("Module facile — Lecture"), "easy");
    assert.equal(inferVariantFromLabel("Module difficile"), "hard");
  });

  it("maps Chinese module headings", () => {
    assert.equal(inferModuleNumberFromLabel("阅读写作 模块 1"), 1);
    assert.equal(inferVariantFromLabel("数学 模块 B"), "hard");
  });

  it("maps Arabic module headings", () => {
    assert.equal(inferModuleNumberFromLabel("الرياضيات وحدة 2"), 2);
    assert.equal(inferVariantFromLabel("وحدة أ"), "easy");
  });

  it("keeps Modül 1 when Kolay appears in same title", () => {
    assert.equal(inferModuleNumberFromLabel("Modül 1 — Kolay"), 1);
    assert.equal(inferVariantFromLabel("Modül 1 — Kolay"), null);
  });
});

describe("buildSatExtractionPlan", () => {
  it("returns 6 buckets for six_module", () => {
    const plan = buildSatExtractionPlan("six_module");
    assert.equal(plan.length, 6);
    assert.ok(plan.some((b) => b.section === "rw" && b.variant === "easy"));
    assert.ok(plan.some((b) => b.section === "math" && b.variant === "hard"));
  });
  it("returns 4 buckets for none", () => {
    assert.equal(buildSatExtractionPlan("none").length, 4);
  });
});

describe("validateSatModuleReport six_module", () => {
  it("accepts rw2=0 when easy+hard populated", () => {
    const report = buildSatModuleReport([
      { sat_section: "rw", sat_module: 1 },
      { sat_section: "rw", sat_module: 2, sat_module_variant: "easy" },
      { sat_section: "rw", sat_module: 2, sat_module_variant: "hard" },
      { sat_section: "math", sat_module: 1 },
      { sat_section: "math", sat_module: 2, sat_module_variant: "easy" },
      { sat_section: "math", sat_module: 2, sat_module_variant: "hard" },
    ]);
    // pad counts artificially
    const full = {
      ...report,
      rw1: 27,
      rw2Easy: 27,
      rw2Hard: 27,
      math1: 22,
      math2Easy: 22,
      math2Hard: 22,
    };
    const v = validateSatModuleReport(full, "six_module");
    assert.equal(v.ok, true);
  });

  it("rejects missing rw second stage", () => {
    const v = validateSatModuleReport(
      {
        rw1: 27,
        rw2: 0,
        rw2Easy: 0,
        rw2Hard: 0,
        math1: 22,
        math2: 44,
        math2Easy: 22,
        math2Hard: 22,
      },
      "six_module"
    );
    assert.equal(v.ok, false);
  });
});

describe("parseStructureDiscovery", () => {
  it("parses minimal JSON", () => {
    const raw = JSON.stringify({
      sections: [
        {
          section: "rw",
          blocks: [
            {
              detectedTitle: "Module 1",
              inferredModule: 1,
              inferredVariant: null,
              approxQuestionCount: 27,
            },
            {
              detectedTitle: "Module A",
              inferredModule: 2,
              inferredVariant: "easy",
            },
          ],
        },
      ],
      suggestedAdaptiveMode: "six_module",
      namingStyle: "module_letter_ab",
    });
    const s = parseStructureDiscovery(raw);
    assert.ok(s);
    assert.equal(s.suggestedAdaptiveMode, "six_module");
    assert.equal(s.sections[0].blocks.length, 2);
  });
});

describe("formatSatModuleReport", () => {
  it("includes easy/hard split", () => {
    const s = formatSatModuleReport({
      rw1: 27,
      rw2: 0,
      rw2Easy: 27,
      rw2Hard: 27,
      math1: 22,
      math2: 0,
      math2Easy: 22,
      math2Hard: 22,
    });
    assert.match(s, /M2-Easy/);
    assert.match(s, /M2-Hard/);
  });
});
