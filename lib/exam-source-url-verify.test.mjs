import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifyExamSourceUrl } from "./exam-source-url-verify.ts";

function mockFetch(handler) {
  return async (url, init) => {
    const result = handler(String(url), init?.method ?? "GET");
    if (result instanceof Error) throw result;
    return result;
  };
}

describe("verifyExamSourceUrl", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("accepts 200 HEAD", async () => {
    const fetchImpl = mockFetch((_url, method) => {
      assert.equal(method, "HEAD");
      return new Response(null, { status: 200 });
    });
    const r = await verifyExamSourceUrl("https://example.com/book", { fetchImpl });
    assert.equal(r.ok, true);
  });

  it("rejects 404", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 404 }));
    const r = await verifyExamSourceUrl("https://example.com/missing", { fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /404/);
  });

  it("blocks localhost SSRF", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 200 }));
    const r = await verifyExamSourceUrl("https://localhost/test", { fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /not allowed/i);
  });

  it("falls back to GET when HEAD returns 405", async () => {
    let calls = 0;
    const fetchImpl = mockFetch((_url, method) => {
      calls++;
      if (method === "HEAD") return new Response(null, { status: 405 });
      if (method === "GET") return new Response(null, { status: 200 });
      return new Response(null, { status: 500 });
    });
    const r = await verifyExamSourceUrl("https://example.com/book", { fetchImpl });
    assert.equal(r.ok, true);
    assert.equal(calls, 2);
  });

  it("rejects timeout", async () => {
    const fetchImpl = mockFetch(() => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });
    const r = await verifyExamSourceUrl("https://example.com/slow", { fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /timed out/i);
  });

  it("rejects http URLs", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 200 }));
    const r = await verifyExamSourceUrl("http://example.com/book", { fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /https/i);
  });

  it("blocks collegeboard.org", async () => {
    const fetchImpl = mockFetch(() => new Response(null, { status: 200 }));
    const r = await verifyExamSourceUrl("https://www.collegeboard.org/practice", {
      fetchImpl,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /not allowed/i);
  });
});
