import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectPdfSectionMismatchProse,
  isModelEmptyArrayFailure,
  parseJsonFromResponseDetailed,
} from "./sat-gemini-extract.ts";

describe("runSatApStyleExtraction contract", () => {
  it("parseJsonFromResponseDetailed handles valid array", () => {
    const r = parseJsonFromResponseDetailed(
      '[{"content":"q1 stem long enough","options":["A","B","C","D"],"sat_section":"rw","sat_module":1}]'
    );
    assert.equal(r.questions.length, 1);
    assert.equal(r.failureReason, "valid_array");
  });

  it("isModelEmptyArrayFailure detects intentional empty array", () => {
    assert.equal(isModelEmptyArrayFailure("valid_array", 0), true);
    assert.equal(isModelEmptyArrayFailure("parse_error", 0), false);
  });

  it("detectPdfSectionMismatchProse finds section mismatch", () => {
    assert.equal(
      detectPdfSectionMismatchProse("PDF only contains Reading and Writing"),
      true
    );
  });
});
