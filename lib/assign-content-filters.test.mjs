import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveMcqSubjects,
  filterFrqExams,
  filterMcqExams,
  filterResources,
  matchesQuestionCountBucket,
} from "./assign-content-filters.ts";

const mcqItems = [
  {
    id: "1",
    title: "AP Calc AB Practice",
    subject: "AP_CALCULUS_AB",
    subjectLabel: "AP Calculus AB",
    examProgram: "AP",
    questionCount: 30,
    source: "mine",
    alreadyAssigned: false,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "2",
    title: "SAT Math Drill",
    subject: "SAT_MATH",
    subjectLabel: "SAT Math",
    examProgram: "SAT",
    questionCount: 15,
    source: "public",
    ownerUsername: "teacher1",
    alreadyAssigned: true,
    createdAt: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "3",
    title: "AP Bio Unit 1",
    subject: "AP_BIOLOGY",
    subjectLabel: "AP Biology",
    examProgram: "AP",
    questionCount: 44,
    source: "public",
    alreadyAssigned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("matchesQuestionCountBucket", () => {
  it("matches 1-20 bucket", () => {
    assert.equal(matchesQuestionCountBucket(15, "1-20"), true);
    assert.equal(matchesQuestionCountBucket(21, "1-20"), false);
  });

  it("matches 41+ bucket", () => {
    assert.equal(matchesQuestionCountBucket(44, "41+"), true);
    assert.equal(matchesQuestionCountBucket(40, "41+"), false);
  });
});

describe("filterMcqExams", () => {
  it("matches search on title and subject label", () => {
    const filtered = filterMcqExams(mcqItems, {
      search: "sat math",
      program: "all",
      subject: "",
      source: "all",
      questionCount: "all",
      sort: "newest",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "2");
  });

  it("filters by source mine vs public", () => {
    const mine = filterMcqExams(mcqItems, {
      search: "",
      program: "all",
      subject: "",
      source: "mine",
      questionCount: "all",
      sort: "newest",
    });
    assert.deepEqual(
      mine.map((item) => item.id),
      ["1"]
    );

    const pub = filterMcqExams(mcqItems, {
      search: "",
      program: "all",
      subject: "",
      source: "public",
      questionCount: "all",
      sort: "newest",
    });
    assert.deepEqual(
      pub.map((item) => item.id),
      ["2", "3"]
    );
  });

  it("filters by question count bucket", () => {
    const filtered = filterMcqExams(mcqItems, {
      search: "",
      program: "all",
      subject: "",
      source: "all",
      questionCount: "21-40",
      sort: "newest",
    });
    assert.deepEqual(
      filtered.map((item) => item.id),
      ["1"]
    );
  });

  it("keeps already-assigned items visible", () => {
    const filtered = filterMcqExams(mcqItems, {
      search: "sat",
      program: "all",
      subject: "",
      source: "all",
      questionCount: "all",
      sort: "newest",
    });
    assert.equal(filtered[0].alreadyAssigned, true);
  });
});

describe("deriveMcqSubjects", () => {
  it("returns sorted unique subjects", () => {
    const subjects = deriveMcqSubjects(mcqItems);
    assert.deepEqual(subjects, ["AP_BIOLOGY", "AP_CALCULUS_AB", "SAT_MATH"]);
  });
});

describe("filterFrqExams", () => {
  it("filters by course and search", () => {
    const items = [
      {
        id: "f1",
        title: "US History DBQ Set",
        courseId: "AP_US_HISTORY",
        courseLabel: "AP US History",
        questionCount: 3,
        maxScore: 18,
        alreadyAssigned: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "f2",
        title: "CSA Coding FRQ",
        courseId: "AP_CSA",
        courseLabel: "AP CSA",
        questionCount: 4,
        maxScore: 24,
        alreadyAssigned: false,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    const filtered = filterFrqExams(items, {
      search: "dbq",
      courseId: "AP_US_HISTORY",
      questionCount: "all",
      sort: "title",
    });
    assert.deepEqual(
      filtered.map((item) => item.id),
      ["f1"]
    );
  });
});

describe("filterResources", () => {
  it("filters by type and visibility", () => {
    const items = [
      {
        id: "r1",
        title: "Study Guide PDF",
        resourceType: "file",
        visibility: "private",
        externalUrl: null,
        alreadyAssigned: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        title: "Khan Link",
        resourceType: "link",
        visibility: "public",
        externalUrl: "https://example.com",
        alreadyAssigned: true,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    const filtered = filterResources(items, {
      search: "",
      resourceType: "link",
      visibility: "public",
      sort: "newest",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "r2");
    assert.equal(filtered[0].alreadyAssigned, true);
  });
});
