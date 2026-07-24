import { parseUnknownError } from "@/lib/error-logging/parse-error";

/** Benign client errors that should not open the global error modal. */
export function isIgnorableClientError(error: unknown): boolean {
  if (error == null) return true;

  const parsed = parseUnknownError(error);
  const name = parsed.name;
  const message = parsed.message.toLowerCase();

  if (name === "AbortError" || name === "TimeoutError") return true;
  if (message.includes("abort") || message.includes("aborted")) return true;
  if (message.includes("cancelled") || message.includes("canceled")) return true;
  if (name === "ChunkLoadError" || message.includes("loading chunk")) return true;
  if (message.includes("resizeobserver")) return true;
  if (name === "NEXT_REDIRECT" || message.includes("next_redirect")) return true;
  if (name === "NextRouterError") return true;
  if (message.includes("auth session missing")) return true;
  if (message.includes("invalid refresh token")) return true;
  if (message.includes("adsbygoogle")) return true;
  if (message.includes("failed to fetch")) return true;
  if (message.includes("networkerror")) return true;
  if (message.includes("network error")) return true;
  if (message.includes("load failed")) return true;
  if (message.includes("fetch failed")) return true;

  return false;
}
