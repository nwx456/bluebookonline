import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatMathNotation,
  formatMathTextIfNeeded,
  shouldFormatMathNotation,
} from "./math-notation-display.ts";

describe("formatMathNotation", () => {
  it("converts caret exponents to superscripts", () => {
    assert.equal(formatMathNotation("x^2"), "x²");
    assert.equal(formatMathNotation("x^2 + y^3"), "x² + y³");
    assert.equal(formatMathNotation("(x+1)^2"), "(x+1)²");
    assert.equal(formatMathNotation("2^10"), "2¹⁰");
    assert.equal(formatMathNotation("a^b"), "aᵇ");
  });

  it("converts braced and negative exponents", () => {
    assert.equal(formatMathNotation("x^{2}"), "x²");
    assert.equal(formatMathNotation("10^(-3)"), "10⁻³");
  });

  it("converts subscripts and common symbols", () => {
    assert.equal(formatMathNotation("x_{1}"), "x₁");
    assert.equal(formatMathNotation("sqrt(x)"), "√(x)");
    assert.equal(formatMathNotation("pi"), "π");
    assert.equal(formatMathNotation("x <= 5"), "x ≤ 5");
    assert.equal(formatMathNotation("a >= b"), "a ≥ b");
  });

  it("leaves plain text unchanged", () => {
    assert.equal(formatMathNotation("Which value is correct?"), "Which value is correct?");
  });
});

describe("shouldFormatMathNotation", () => {
  it("enables for SAT Math and math modules only", () => {
    assert.equal(shouldFormatMathNotation("SAT_MATH"), true);
    assert.equal(shouldFormatMathNotation("SAT_FULL_TEST", "math"), true);
    assert.equal(shouldFormatMathNotation("SAT_FULL_TEST", "rw"), false);
    assert.equal(shouldFormatMathNotation("SAT_RW"), false);
  });
});

describe("formatMathTextIfNeeded", () => {
  it("formats only when enabled", () => {
    assert.equal(formatMathTextIfNeeded("x^2", true), "x²");
    assert.equal(formatMathTextIfNeeded("x^2", false), "x^2");
  });
});
