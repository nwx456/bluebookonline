import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { partitionSatStemAndPassage } from "./sat-ingest-postprocess.ts";

describe("partitionSatStemAndPassage", () => {
  it("splits R&W multi-paragraph passage from question_text when passage_text is empty", () => {
    const passage =
      "In the early twentieth century, many writers experimented with form.\n\nThey challenged readers to reconsider narrative conventions.";
    const stem = "Which choice best states the main idea of the passage?";
    const full = `${passage}\n\n${stem}`;
    const result = partitionSatStemAndPassage(full, null, "rw");
    assert.ok(result.passage?.includes("early twentieth century"));
    assert.equal(result.stem, stem);
  });

  it("merges line-based bullets into passage before stem", () => {
    const full = [
      "• First point about the text",
      "• Second point about the text",
      "Which choice completes the text with the most logical transition?",
    ].join("\n");
    const result = partitionSatStemAndPassage(full, null, "rw");
    assert.match(result.passage ?? "", /First point/);
    assert.match(result.stem, /Which choice/);
  });

  it("keeps existing passage_text when stem has no splittable prefix", () => {
    const result = partitionSatStemAndPassage(
      "Which choice is correct?",
      "Long stored passage text that already lives in passage_text field.",
      "rw"
    );
    assert.equal(result.stem, "Which choice is correct?");
    assert.match(result.passage ?? "", /stored passage/);
  });

  it("splits math table rows from stem", () => {
    const full = "| x | y |\n| 1 | 2 |\nWhat is the value of y when x = 3?";
    const result = partitionSatStemAndPassage(full, null, "math");
    assert.match(result.passage ?? "", /\| x \| y \|/);
    assert.match(result.stem, /value of y/);
  });
});
