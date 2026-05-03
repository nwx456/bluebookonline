function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isTransientSendError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as Record<string, unknown>;

  const status = o.status ?? o.statusCode;
  if (typeof status === "number") {
    if (status === 429 || status === 503 || status === 502 || status === 504) return true;
    if (status >= 500) return true;
    if (status >= 400 && status < 500) return false;
  }

  const code = o.code;
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ECONNRESET")
    return true;

  const responseCode = o.responseCode;
  if (typeof responseCode === "number" && responseCode >= 500) return true;

  const message = typeof o.message === "string" ? o.message : "";
  if (/timeout|ECONNRESET|socket|network/i.test(message)) return true;

  return false;
}

export async function withSendRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt === maxRetries || !isTransientSendError(e)) throw e;
      await sleep(2 ** attempt * 400);
    }
  }
  throw last;
}
