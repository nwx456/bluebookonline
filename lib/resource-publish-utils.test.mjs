import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canMakeResourcePrivate,
  canRequestResourcePublish,
  getResourceModerationStatusLabel,
  isResourceLivePublic,
  isResourcePendingReview,
} from "./resource-publish-utils.ts";

describe("isResourceLivePublic", () => {
  it("is true when public and approved", () => {
    assert.equal(
      isResourceLivePublic({ visibility: "public", moderationStatus: "approved" }),
      true
    );
  });

  it("is false when pending review", () => {
    assert.equal(
      isResourceLivePublic({ visibility: "public", moderationStatus: "pending_review" }),
      false
    );
  });
});

describe("canRequestResourcePublish", () => {
  it("allows private draft resources", () => {
    assert.equal(
      canRequestResourcePublish({ visibility: "private", moderationStatus: "draft" }),
      true
    );
  });

  it("allows re-request after rejection", () => {
    assert.equal(
      canRequestResourcePublish({ visibility: "private", moderationStatus: "rejected" }),
      true
    );
    assert.equal(
      canRequestResourcePublish({ visibility: "public", moderationStatus: "rejected" }),
      true
    );
  });

  it("blocks pending review", () => {
    assert.equal(
      canRequestResourcePublish({ visibility: "public", moderationStatus: "pending_review" }),
      false
    );
  });

  it("blocks already published", () => {
    assert.equal(
      canRequestResourcePublish({ visibility: "public", moderationStatus: "approved" }),
      false
    );
  });
});

describe("canMakeResourcePrivate", () => {
  it("allows unpublish only when live public", () => {
    assert.equal(
      canMakeResourcePrivate({ visibility: "public", moderationStatus: "approved" }),
      true
    );
    assert.equal(
      canMakeResourcePrivate({ visibility: "private", moderationStatus: "draft" }),
      false
    );
  });
});

describe("status labels", () => {
  it("returns Pending for pending review", () => {
    assert.equal(
      getResourceModerationStatusLabel({
        visibility: "public",
        moderationStatus: "pending_review",
      }),
      "Pending"
    );
    assert.equal(
      isResourcePendingReview({ visibility: "public", moderationStatus: "pending_review" }),
      true
    );
  });
});
