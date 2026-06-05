import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBulletPassage } from "./passage-display.ts";

describe("parseBulletPassage", () => {
  it("splits inline SAT notes with bullet character", () => {
    const text =
      "While researching a topic, a student has taken the following notes: • Parshvanatha, one of the 23 propagators. • Around the 5th century B.C.E., Siddhartha Gautama refrained from eating meat. • Today, companies make plant-based options.";
    const parsed = parseBulletPassage(text);
    assert.equal(parsed.kind, "bullets");
    if (parsed.kind !== "bullets") return;
    assert.match(parsed.intro ?? "", /following notes/);
    assert.equal(parsed.items.length, 3);
    assert.match(parsed.items[0], /Parshvanatha/);
    assert.match(parsed.items[1], /5th century/);
  });

  it("splits line-based bullets", () => {
    const text = "Consider the passage.\n• First point\n• Second point";
    const parsed = parseBulletPassage(text);
    assert.equal(parsed.kind, "bullets");
    if (parsed.kind !== "bullets") return;
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0], "First point");
  });

  it("returns plain for text without bullets", () => {
    const parsed = parseBulletPassage("A short single paragraph with no list.");
    assert.equal(parsed.kind, "plain");
  });
});
