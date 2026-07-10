import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSatUploadModuleFields } from "./sat-upload-module-fields.ts";

describe("getSatUploadModuleFields", () => {
  it("six_module R&W section_test → 3 fields", () => {
    const fields = getSatUploadModuleFields({
      subject: "SAT_RW",
      satFormat: "section_test",
      satAdaptiveMode: "six_module",
    });
    assert.equal(fields.length, 3);
    assert.deepEqual(fields.map((f) => f.key), ["rw1", "rw2easy", "rw2hard"]);
    assert.equal(fields[0].defaultCount, 27);
  });

  it("full_test none → 4 fields", () => {
    const fields = getSatUploadModuleFields({
      subject: "SAT_FULL_TEST",
      satFormat: "full_test",
      satAdaptiveMode: "none",
    });
    assert.equal(fields.length, 4);
    assert.deepEqual(fields.map((f) => f.key), ["rw1", "rw2", "math1", "math2"]);
  });
});
