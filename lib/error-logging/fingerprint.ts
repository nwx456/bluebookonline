import { createHash } from "crypto";
import type { ErrorLogSource } from "./types";

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ").slice(0, 500);
}

export function buildErrorFingerprint(input: {
  source: ErrorLogSource;
  errorName: string;
  message: string;
  pageUrl?: string | null;
  endpoint?: string | null;
}): string {
  const location = (input.endpoint ?? input.pageUrl ?? "").trim().slice(0, 300);
  const payload = [
    input.source,
    input.errorName.trim() || "Error",
    normalizeMessage(input.message || "Unknown error"),
    location,
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}
