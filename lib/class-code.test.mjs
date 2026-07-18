import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_CODE_LENGTH,
  generateClassCode,
  isValidClassCodeFormat,
  normalizeClassCode,
} from "./class-code.ts";

describe("generateClassCode", () => {
  it("generates code of expected length", () => {
    const code = generateClassCode();
    assert.equal(code.length, CLASS_CODE_LENGTH);
  });

  it("uses only allowed charset characters", () => {
    const code = generateClassCode(20);
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});

describe("normalizeClassCode", () => {
  it("uppercases and strips spaces", () => {
    assert.equal(normalizeClassCode(" ab cd12 "), "ABCD12");
  });
});

describe("isValidClassCodeFormat", () => {
  it("accepts 8-char alphanumeric", () => {
    assert.equal(isValidClassCodeFormat("ABCD1234"), true);
  });

  it("rejects wrong length", () => {
    assert.equal(isValidClassCodeFormat("ABC"), false);
  });
});
