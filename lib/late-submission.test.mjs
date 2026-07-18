import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeIsLate } from "./late-submission.ts";

describe("computeIsLate", () => {
  it("returns false when due date is missing", () => {
    assert.equal(computeIsLate(new Date("2026-07-20T12:00:00Z"), null), false);
  });

  it("returns false when completed before due", () => {
    assert.equal(
      computeIsLate(
        new Date("2026-07-18T10:00:00Z"),
        "2026-07-18T12:00:00.000Z"
      ),
      false
    );
  });

  it("returns true when completed after due", () => {
    assert.equal(
      computeIsLate(
        new Date("2026-07-18T13:00:00Z"),
        "2026-07-18T12:00:00.000Z"
      ),
      true
    );
  });

  it("returns false for invalid due date", () => {
    assert.equal(computeIsLate(new Date(), "not-a-date"), false);
  });
});
