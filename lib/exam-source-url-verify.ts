const VERIFY_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "APPracticeExamOnline-SourceVerify/1.0";
const MAX_SOURCE_URL_LEN = 2048;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

export type SourceUrlVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

function normalizeHttpsUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "A source URL is required for books and agencies." };
  }
  if (trimmed.length > MAX_SOURCE_URL_LEN) {
    return { ok: false, error: "Source URL is too long." };
  }
  if (!trimmed.startsWith("https://")) {
    return { ok: false, error: "Source URL must start with https://." };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return { ok: false, error: "Source URL must use HTTPS." };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: "Source URL is not valid." };
  }
}

function parseIPv4(hostname: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split(".").map((p) => Number(p));
  if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return parts;
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateOrBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;

  const ipv4 = parseIPv4(h);
  if (ipv4 && isPrivateIPv4(ipv4)) return true;

  if (h.includes(":")) {
    if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
      return true;
    }
  }
  return false;
}

function assertUrlHostAllowed(url: string): SourceUrlVerifyResult | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Source URL is not valid." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Source URL must use HTTPS." };
  }
  if (isPrivateOrBlockedHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "This source URL is not allowed. Use a public publisher or agency page.",
    };
  }
  return null;
}

type FetchFn = typeof fetch;

async function requestWithRedirects(
  startUrl: string,
  method: "HEAD" | "GET",
  fetchImpl: FetchFn
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = assertUrlHostAllowed(current);
    if (blocked && !blocked.ok) {
      throw new SourceUrlVerifyError(blocked.error);
    }

    const res = await fetchImpl(current, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        return res;
      }
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new SourceUrlVerifyError(
    "This source URL could not be reached. Check the link and try again."
  );
}

class SourceUrlVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceUrlVerifyError";
  }
}

function statusErrorMessage(status: number): string {
  if (status === 404) {
    return "This source URL returned an error (404). Use a working page for the book or agency.";
  }
  return `This source URL returned an error (${status}). Use a working page for the book or agency.`;
}

async function probeUrl(
  url: string,
  fetchImpl: FetchFn
): Promise<SourceUrlVerifyResult> {
  try {
    let res = await requestWithRedirects(url, "HEAD", fetchImpl);
    if (res.status === 405 || res.status === 501) {
      res = await requestWithRedirects(url, "GET", fetchImpl);
    }
    if (res.status >= 200 && res.status < 300) {
      await res.body?.cancel?.();
      return { ok: true };
    }
    await res.body?.cancel?.();
    return { ok: false, error: statusErrorMessage(res.status) };
  } catch (e) {
    if (e instanceof SourceUrlVerifyError) {
      return { ok: false, error: e.message };
    }
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return {
        ok: false,
        error: "Source URL verification timed out. Try again or use a different link.",
      };
    }
    return {
      ok: false,
      error: "This source URL could not be reached. Check the link and try again.",
    };
  }
}

export async function verifyExamSourceUrl(
  rawUrl: string,
  options?: { fetchImpl?: FetchFn }
): Promise<SourceUrlVerifyResult> {
  const format = normalizeHttpsUrl(rawUrl);
  if (!format.ok) return format;

  const hostBlocked = assertUrlHostAllowed(format.url);
  if (hostBlocked) return hostBlocked;

  const fetchImpl = options?.fetchImpl ?? fetch;
  return probeUrl(format.url, fetchImpl);
}
