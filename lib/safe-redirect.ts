const ALLOWED_PREFIXES = ["/exam/", "/dashboard", "/settings/", "/exams/", "/teacher"] as const;

/**
 * Validates a post-auth redirect path. Returns a safe relative path or null.
 * Rejects open redirects, protocol-relative URLs, and paths outside the allowlist.
 */
export function sanitizeRedirectPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;

  let decoded = raw.trim();
  if (!decoded) return null;

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(decoded)) return null;

  const pathOnly = decoded.split(/[?#]/)[0] ?? decoded;
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => pathOnly === prefix.replace(/\/$/, "") || pathOnly.startsWith(prefix)
  );
  if (!allowed) return null;

  return decoded;
}
