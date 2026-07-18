import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatSourceAttribution,
  validateExamSource,
} from "./exam-source.ts";

describe("validateExamSource", () => {
  it("accepts school with name only", () => {
    const r = validateExamSource({
      sourceType: "school",
      sourceName: "Lincoln High School",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.normalized.sourceUrl, null);
      assert.equal(r.normalized.sourceName, "Lincoln High School");
    }
  });

  it("accepts school without custom name", () => {
    const r = validateExamSource({
      sourceType: "school",
      sourceName: "",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.normalized.sourceUrl, null);
      assert.equal(r.normalized.sourceName, "Personal or school materials");
    }
  });

  it("requires URL for book", () => {
    const r = validateExamSource({
      sourceType: "book",
      sourceName: "Barron's AP Calc",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, false);
  });

  it("accepts book with https URL", () => {
    const r = validateExamSource({
      sourceType: "book",
      sourceName: "Barron's AP Calc",
      sourceUrl: "https://www.barronseduc.com/ap-calculus",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, true);
  });

  it("rejects collegeboard.org URL", () => {
    const r = validateExamSource({
      sourceType: "agency",
      sourceName: "Some Agency",
      sourceUrl: "https://www.collegeboard.org/practice",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, false);
  });

  it("rejects without official confirmation", () => {
    const r = validateExamSource({
      sourceType: "school",
      sourceName: "Test School",
      notOfficialConfirmed: false,
    });
    assert.equal(r.ok, false);
  });

  it("rejects http URLs", () => {
    const r = validateExamSource({
      sourceType: "book",
      sourceName: "Book",
      sourceUrl: "http://example.com/book",
      notOfficialConfirmed: true,
    });
    assert.equal(r.ok, false);
  });
});

describe("formatSourceAttribution", () => {
  it("formats school without URL", () => {
    const r = formatSourceAttribution({
      source_type: "school",
      source_name: "Ankara Science High School",
      source_url: null,
    });
    assert.ok(r);
    assert.match(r.text, /materials provided by Ankara Science High School/);
    assert.equal(r.url, null);
  });

  it("formats school default name without byline", () => {
    const r = formatSourceAttribution({
      source_type: "school",
      source_name: "Personal or school materials",
      source_url: null,
    });
    assert.ok(r);
    assert.equal(
      r.text,
      "Questions adapted from personal or school-provided materials"
    );
    assert.equal(r.url, null);
  });

  it("formats book with URL", () => {
    const r = formatSourceAttribution({
      source_type: "book",
      source_name: "Princeton Review SAT",
      source_url: "https://example.com/book",
    });
    assert.ok(r);
    assert.match(r.text, /Questions adapted from Princeton Review SAT/);
    assert.equal(r.url, "https://example.com/book");
  });

  it("returns null for missing fields", () => {
    assert.equal(formatSourceAttribution({ source_type: null, source_name: null }), null);
  });
});
