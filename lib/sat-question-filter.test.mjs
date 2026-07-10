import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dropRowsWithoutSection,
  salvageFilterSatQuestions,
} from "./sat-question-filter.ts";

function makePlaceholderMcq(i) {
  return {
    content: `Which choice best states the main idea of passage ${i}?`,
    image_description: "Sample passage text for testing salvage filter behavior.",
    options: ["A", "B", "C", "D"],
    question_type: "mcq",
    sat_section: "rw",
  };
}

describe("salvageFilterSatQuestions", () => {
  it("keeps 27 questions when 11 have placeholder A,B,C,D options", () => {
    const qs = [];
    for (let i = 0; i < 27; i++) {
      qs.push(makePlaceholderMcq(i));
    }
    const { kept, dropped } = salvageFilterSatQuestions(qs);
    assert.equal(kept.length, 27);
    assert.equal(dropped.length, 0);
  });

  it("keeps question with only passage (short stem)", () => {
    const { kept } = salvageFilterSatQuestions([
      {
        content: "",
        image_description:
          "Long passage text that should be enough to salvage this row even without a stem.",
        options: ["A", "B", "C", "D"],
      },
    ]);
    assert.equal(kept.length, 1);
  });

  it("keeps math MCQ with single option (truncation)", () => {
    const { kept } = salvageFilterSatQuestions([
      {
        content: "What is the value of x?",
        options: ["Only one choice text here"],
        question_type: "mcq",
      },
    ]);
    assert.equal(kept.length, 1);
  });

  it("drops truly empty rows", () => {
    const { kept, dropped } = salvageFilterSatQuestions([
      { content: "", options: [] },
      { content: "   ", image_description: "short" },
    ]);
    assert.equal(kept.length, 0);
    assert.equal(dropped.length, 2);
  });

  it("keeps grid-in with stem only", () => {
    const { kept } = salvageFilterSatQuestions([
      {
        content: "Enter your answer in the box below.",
        options: [],
        question_type: "grid_in",
      },
    ]);
    assert.equal(kept.length, 1);
  });
});

describe("dropRowsWithoutSection", () => {
  it("drops rows missing sat_section", () => {
    const result = dropRowsWithoutSection([
      { sat_section: "rw", sat_module: 1 },
      { sat_section: null, sat_module: 1 },
      { sat_module: 1 },
      { sat_section: "math", sat_module: 2 },
    ]);
    assert.equal(result.length, 2);
  });

  it("drops rows with invalid sat_module", () => {
    const result = dropRowsWithoutSection([
      { sat_section: "rw", sat_module: 1 },
      { sat_section: "rw", sat_module: 0 },
      { sat_section: "rw", sat_module: 3 },
      { sat_section: "rw", sat_module: null },
      { sat_section: "math", sat_module: 2 },
    ]);
    assert.equal(result.length, 2);
  });

  it("accepts lowercase and trimmed sat_section", () => {
    const result = dropRowsWithoutSection([
      { sat_section: "RW ", sat_module: 1 },
      { sat_section: " Math", sat_module: 2 },
    ]);
    assert.equal(result.length, 2);
  });
});
