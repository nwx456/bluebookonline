import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAssignmentRowActions,
  getAssignmentViewPath,
} from "./teacher-assignment-content.ts";

const mcqAssignment = {
  id: "a1",
  kind: "exam",
  uploadId: "u1",
  frqUploadId: null,
  resourceId: null,
  title: "AP Calc",
  dueAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  content: { isPublished: false, moderationStatus: "draft" },
};

const resourceAssignment = {
  id: "a2",
  kind: "resource",
  uploadId: null,
  frqUploadId: null,
  resourceId: "r1",
  title: "Study guide",
  dueAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  content: {
    resourceType: "file",
    visibility: "public",
    moderationStatus: "approved",
    externalUrl: null,
    fileName: "guide.pdf",
  },
};

describe("getAssignmentViewPath", () => {
  it("returns exam and frq paths", () => {
    assert.equal(getAssignmentViewPath(mcqAssignment), "/exam/u1");
    assert.equal(
      getAssignmentViewPath({
        ...mcqAssignment,
        kind: "frq_exam",
        uploadId: null,
        frqUploadId: "f1",
      }),
      "/frq/f1"
    );
  });
});

describe("getAssignmentRowActions", () => {
  it("shows publish for private draft exam", () => {
    const actions = getAssignmentRowActions(mcqAssignment);
    assert.equal(actions.showView, true);
    assert.equal(actions.showPublish, true);
    assert.equal(actions.showMakePrivate, false);
    assert.equal(actions.showShare, false);
    assert.equal(actions.statusLabel, "Private");
  });

  it("shows share for live public resource", () => {
    const actions = getAssignmentRowActions(resourceAssignment);
    assert.equal(actions.showView, true);
    assert.equal(actions.showPublish, false);
    assert.equal(actions.showMakePrivate, true);
    assert.equal(actions.showShare, true);
    assert.equal(actions.statusLabel, "Published");
  });

  it("shows pending state for exam awaiting review", () => {
    const actions = getAssignmentRowActions({
      ...mcqAssignment,
      content: { isPublished: false, moderationStatus: "pending_review" },
    });
    assert.equal(actions.showPublish, false);
    assert.equal(actions.statusLabel, "Pending");
  });
});
