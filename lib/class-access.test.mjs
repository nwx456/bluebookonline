import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canStartExamAccess, canAccessResource } from "./class-access.ts";

describe("canStartExamAccess", () => {
  it("allows owner", () => {
    assert.equal(
      canStartExamAccess({ isOwner: true, isPublic: false, hasAssignmentAccess: false }),
      true
    );
  });

  it("allows public exam", () => {
    assert.equal(
      canStartExamAccess({ isOwner: false, isPublic: true, hasAssignmentAccess: false }),
      true
    );
  });

  it("allows assignment member for private exam", () => {
    assert.equal(
      canStartExamAccess({ isOwner: false, isPublic: false, hasAssignmentAccess: true }),
      true
    );
  });

  it("denies non-member for private exam", () => {
    assert.equal(
      canStartExamAccess({ isOwner: false, isPublic: false, hasAssignmentAccess: false }),
      false
    );
  });
});

describe("canAccessResource", () => {
  it("allows owner, public, or assigned member", () => {
    assert.equal(
      canAccessResource({ isOwner: true, isPublicApproved: false, isAssignedClassMember: false }),
      true
    );
    assert.equal(
      canAccessResource({ isOwner: false, isPublicApproved: true, isAssignedClassMember: false }),
      true
    );
    assert.equal(
      canAccessResource({ isOwner: false, isPublicApproved: false, isAssignedClassMember: true }),
      true
    );
  });

  it("denies unrelated user", () => {
    assert.equal(
      canAccessResource({ isOwner: false, isPublicApproved: false, isAssignedClassMember: false }),
      false
    );
  });
});
