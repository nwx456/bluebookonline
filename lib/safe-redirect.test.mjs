import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRedirectPath } from "./safe-redirect.ts";

describe("sanitizeRedirectPath", () => {
  it("accepts exam paths with query strings", () => {
    assert.equal(
      sanitizeRedirectPath("/exam/abc-123?resume=attempt-1"),
      "/exam/abc-123?resume=attempt-1"
    );
  });

  it("accepts dashboard and settings paths", () => {
    assert.equal(sanitizeRedirectPath("/dashboard"), "/dashboard");
    assert.equal(sanitizeRedirectPath("/settings/privacy"), "/settings/privacy");
  });

  it("accepts exams subject pages", () => {
    assert.equal(sanitizeRedirectPath("/exams/ap-csa"), "/exams/ap-csa");
    assert.equal(sanitizeRedirectPath("/exams/sat-rw?program=sat"), "/exams/sat-rw?program=sat");
  });

  it("accepts teacher paths", () => {
    assert.equal(sanitizeRedirectPath("/teacher"), "/teacher");
    assert.equal(sanitizeRedirectPath("/teacher/classes/abc"), "/teacher/classes/abc");
  });

  it("rejects open redirects", () => {
    assert.equal(sanitizeRedirectPath("//evil.com"), null);
    assert.equal(sanitizeRedirectPath("https://evil.com"), null);
    assert.equal(sanitizeRedirectPath("javascript:alert(1)"), null);
    assert.equal(sanitizeRedirectPath("/admin/mail"), null);
  });

  it("rejects empty and invalid input", () => {
    assert.equal(sanitizeRedirectPath(""), null);
    assert.equal(sanitizeRedirectPath(null), null);
    assert.equal(sanitizeRedirectPath("%"), null);
  });
});
