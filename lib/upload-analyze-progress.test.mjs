import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClientAnalyzePhases,
  buildSatFullAnalyzePhases,
  formatDuration,
  formatFriendlyAnalyzeError,
  PHASE_UPLOAD,
} from "./upload-analyze-progress.ts";

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    assert.equal(formatDuration(45000), "45s");
    assert.equal(formatDuration(84000), "1m 24s");
    assert.equal(formatDuration(120000), "2m");
  });
});

describe("buildSatFullAnalyzePhases", () => {
  it("includes upload + two section phases for six_module (no discovery phase)", () => {
    const phases = buildSatFullAnalyzePhases("six_module");
    assert.ok(phases.some((p) => p.id === PHASE_UPLOAD));
    assert.ok(!phases.some((p) => p.id === "discovery"));
    assert.equal(phases.filter((p) => p.id.startsWith("section:")).length, 2);
    assert.ok(phases.some((p) => p.id === "section:rw"));
    assert.ok(phases.some((p) => p.id === "section:math"));
  });

  it("includes two section phases for none mode", () => {
    const phases = buildSatFullAnalyzePhases("none");
    assert.equal(phases.filter((p) => p.id.startsWith("section:")).length, 2);
    assert.ok(!phases.some((p) => p.id === "discovery"));
    assert.ok(!phases.some((p) => p.id.startsWith("bucket:")));
  });
});

describe("buildClientAnalyzePhases", () => {
  it("returns total predicted label for SAT full test", () => {
    const { totalPredictedLabel } = buildClientAnalyzePhases({
      subject: "SAT_FULL_TEST",
      satAdaptiveMode: "none",
    });
    assert.match(totalPredictedLabel, /About 3–5 min total/);
    const six = buildClientAnalyzePhases({
      subject: "SAT_FULL_TEST",
      satAdaptiveMode: "six_module",
    });
    assert.match(six.totalPredictedLabel, /About 3–5 min total/);
  });
});

describe("formatFriendlyAnalyzeError", () => {
  it("maps Turkish validation error to English", () => {
    const err = formatFriendlyAnalyzeError("PDF'ten tam SAT çıkarılamadı. Eksik: rw2.", {
      emptyBuckets: ["rw2"],
    });
    assert.equal(err.title, "Incomplete module extraction");
    assert.match(err.reason, /rw2/);
  });
});
