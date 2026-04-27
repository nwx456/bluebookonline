import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { matchesStaticAllowlist } from "@/lib/allowlist";
import { query } from "@/lib/db";
import { isValidSubject } from "@/lib/subjects";
import type { SourceRow } from "@/lib/types";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rows } = await query<SourceRow>(
    `SELECT * FROM sources ORDER BY created_at DESC`
  );
  return NextResponse.json({ sources: rows });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    domain?: unknown;
    name?: unknown;
    defaultSubject?: unknown;
    seedUrls?: unknown;
  };
  const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : domain;
  const defaultSubject = typeof body.defaultSubject === "string" ? body.defaultSubject.trim() : "";
  const seedUrls = Array.isArray(body.seedUrls) ? body.seedUrls.filter((s): s is string => typeof s === "string") : [];

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "invalid domain" }, { status: 400 });
  }
  if (!matchesStaticAllowlist(domain)) {
    return NextResponse.json(
      { error: "domain rejected: must be .edu/.gov or in static allowlist" },
      { status: 400 }
    );
  }
  if (defaultSubject && !isValidSubject(defaultSubject)) {
    return NextResponse.json({ error: "invalid defaultSubject" }, { status: 400 });
  }
  for (const u of seedUrls) {
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (host !== domain && !host.endsWith(`.${domain}`)) {
        return NextResponse.json({ error: `seed url host (${host}) doesn't match domain` }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: `invalid seed url: ${u}` }, { status: 400 });
    }
  }

  const insert = await query<SourceRow>(
    `INSERT INTO sources (domain, name, seed_urls, default_subject)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (domain) DO UPDATE
       SET name = EXCLUDED.name,
           seed_urls = EXCLUDED.seed_urls,
           default_subject = EXCLUDED.default_subject
     RETURNING *`,
    [domain, name, seedUrls, defaultSubject || null]
  );
  await audit("source.upsert", {
    actorEmail: session.email,
    targetId: insert.rows[0].id,
    details: { domain, seedCount: seedUrls.length },
  });
  return NextResponse.json({ source: insert.rows[0] });
}
