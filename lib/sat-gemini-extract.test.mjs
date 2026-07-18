import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseJsonFromResponse,
  parseJsonFromResponseDetailed,
  isModelEmptyArrayFailure,
  detectPdfSectionMismatchProse,
} from "./sat-gemini-extract.ts";

describe("parseJsonFromResponseDetailed", () => {
  it("returns empty_input for blank string", () => {
    const r = parseJsonFromResponseDetailed("");
    assert.deepEqual(r.questions, []);
    assert.equal(r.failureReason, "empty_input");
  });

  it("parses a plain JSON array", () => {
    const r = parseJsonFromResponseDetailed('[{"content":"q1","options":["A"]}]');
    assert.equal(r.questions.length, 1);
    assert.equal(r.failureReason, "valid_array");
  });

  it("unwraps questions wrapper object", () => {
    const r = parseJsonFromResponseDetailed(
      '{"questions":[{"content":"wrapped stem here","options":["A","B"]}]}'
    );
    assert.equal(r.questions.length, 1);
    assert.equal(r.failureReason, "wrapper_unwrapped");
  });

  it("unwraps data/items/results wrappers", () => {
    for (const key of ["data", "items", "results"]) {
      const r = parseJsonFromResponseDetailed(
        `{"${key}":[{"content":"stem for ${key}","options":["X"]}]}`
      );
      assert.equal(r.questions.length, 1, key);
      assert.equal(r.failureReason, "wrapper_unwrapped");
    }
  });

  it("extracts array from markdown code block", () => {
    const r = parseJsonFromResponseDetailed(
      '```json\n[{"content":"in code block","options":[]}]\n```'
    );
    assert.equal(r.questions.length, 1);
  });

  it("recovers truncated JSON array", () => {
    const truncated =
      '[{"content":"first question stem","options":["A","B"]},{"content":"second question","options":["C","D"]},{"content":"third incomplete';
    const r = parseJsonFromResponseDetailed(truncated);
    assert.ok(r.questions.length >= 1);
    assert.equal(r.failureReason, "truncated_recovery");
  });

  it("returns not_array for plain object without wrapper keys", () => {
    const r = parseJsonFromResponseDetailed('{"error":"no questions"}');
    assert.deepEqual(r.questions, []);
    assert.equal(r.failureReason, "not_array");
  });

  it("parseJsonFromResponse backward compat returns questions only", () => {
    const qs = parseJsonFromResponse('[{"content":"ok","options":[]}]');
    assert.equal(qs.length, 1);
  });

  it("isModelEmptyArrayFailure detects intentional empty array", () => {
    assert.equal(isModelEmptyArrayFailure("valid_array", 0), true);
    assert.equal(isModelEmptyArrayFailure("valid_array", 1), false);
    assert.equal(isModelEmptyArrayFailure("parse_error", 0), false);
  });

  it("detectPdfSectionMismatchProse finds R&W-only prose", () => {
    assert.equal(
      detectPdfSectionMismatchProse(
        "Sağlanan PDF yalnızca Reading and Writing bölümlerini içermektedir."
      ),
      true
    );
    assert.equal(detectPdfSectionMismatchProse("[]"), false);
  });
});
