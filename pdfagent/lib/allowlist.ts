import { query } from "./db";
import type { SourceRow } from "./types";

/**
 * Statik domain allowlist (DB'deki sources tablosu da bunu desteklemek için).
 * Yalnızca açık-erişim eğitim/kamu kaynakları.
 */
export const STATIC_ALLOWLIST_DOMAINS: ReadonlyArray<string> = [
  "openstax.org",
  "assets.openstax.org",
  "ocw.mit.edu",
  "ocw.tudelft.nl",
];

export const STATIC_ALLOWLIST_SUFFIXES: ReadonlyArray<string> = [
  ".edu",
  ".gov",
];

export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function matchesStaticAllowlist(host: string): boolean {
  const h = host.toLowerCase();
  if (STATIC_ALLOWLIST_DOMAINS.includes(h)) return true;
  for (const dom of STATIC_ALLOWLIST_DOMAINS) {
    if (h === dom || h.endsWith(`.${dom}`)) return true;
  }
  for (const suf of STATIC_ALLOWLIST_SUFFIXES) {
    if (h.endsWith(suf)) return true;
  }
  return false;
}

/**
 * URL'in hem static allowlist'te (taban güvenlik), hem de DB'de
 * enabled bir source olarak kayıtlı olduğunu doğrular.
 */
export async function isUrlAllowed(url: string): Promise<{ ok: boolean; reason?: string }> {
  const host = getHostname(url);
  if (!host) return { ok: false, reason: "invalid url" };
  if (!matchesStaticAllowlist(host)) {
    return { ok: false, reason: `domain not in static allowlist (${host})` };
  }
  const { rows } = await query<SourceRow>(
    `SELECT * FROM sources WHERE enabled = TRUE AND ($1 = domain OR $1 LIKE '%.' || domain) LIMIT 1`,
    [host]
  );
  if (rows.length === 0) {
    return { ok: false, reason: `no enabled source matches host ${host}` };
  }
  return { ok: true };
}

const robotsCache = new Map<string, { allowed: boolean; expiresAt: number }>();

/**
 * Çok minimalist robots.txt kontrolü: User-agent: * için Disallow path eşleşmesi.
 * Cache 1 saat. Tutucu davranır: hata varsa true döner (saygılı ama gerekli durdurma için fail-open).
 */
export async function isRobotsAllowed(url: string): Promise<boolean> {
  const u = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();
  if (!u) return false;
  const cacheKey = `${u.origin}|${u.pathname}`;
  const cached = robotsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  let allowed = true;
  try {
    const res = await fetch(`${u.origin}/robots.txt`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const txt = await res.text();
      const lines = txt.split(/\r?\n/);
      let inStarBlock = false;
      const disallows: string[] = [];
      for (const raw of lines) {
        const line = raw.split("#")[0].trim();
        if (!line) continue;
        const lower = line.toLowerCase();
        if (lower.startsWith("user-agent:")) {
          const ua = lower.slice("user-agent:".length).trim();
          inStarBlock = ua === "*";
          continue;
        }
        if (inStarBlock && lower.startsWith("disallow:")) {
          const path = line.slice("disallow:".length).trim();
          if (path) disallows.push(path);
        }
      }
      for (const path of disallows) {
        if (u.pathname.startsWith(path)) {
          allowed = false;
          break;
        }
      }
    }
  } catch {
    allowed = true;
  }
  robotsCache.set(cacheKey, { allowed, expiresAt: Date.now() + 60 * 60 * 1000 });
  return allowed;
}
