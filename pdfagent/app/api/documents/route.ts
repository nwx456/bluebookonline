import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { isUrlAllowed } from "@/lib/allowlist";
import { fetchQueue } from "@/lib/queue";
import { isValidSubject } from "@/lib/subjects";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: unknown;
    subject?: unknown;
    questionCount?: unknown;
    hasVisuals?: unknown;
  };

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const questionCount = Number(body.questionCount);
  const hasVisuals = body.hasVisuals === true;

  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!subject || !isValidSubject(subject)) {
    return NextResponse.json({ error: "invalid subject" }, { status: 400 });
  }
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) {
    return NextResponse.json({ error: "questionCount must be 1..200" }, { status: 400 });
  }
  if (!url.toLowerCase().endsWith(".pdf") && !/\.pdf(\?|#|$)/i.test(url)) {
    return NextResponse.json({ error: "url must point to a .pdf" }, { status: 400 });
  }

  const allowed = await isUrlAllowed(url);
  if (!allowed.ok) {
    return NextResponse.json({ error: `Not allowed: ${allowed.reason}` }, { status: 400 });
  }

  const host = new URL(url).hostname.toLowerCase();
  const sourceRow = await query<{ id: string }>(
    `SELECT id FROM sources WHERE enabled = TRUE AND ($1 = domain OR $1 LIKE '%.' || domain) LIMIT 1`,
    [host]
  );
  const sourceId = sourceRow.rows[0]?.id ?? null;

  const insert = await query<{ id: string }>(
    `INSERT INTO documents (source_id, source_url, status, subject, question_count, has_visuals)
     VALUES ($1, $2, 'discovered', $3, $4, $5)
     ON CONFLICT (source_url) DO UPDATE SET subject = EXCLUDED.subject, question_count = EXCLUDED.question_count, has_visuals = EXCLUDED.has_visuals
     RETURNING id`,
    [sourceId, url, subject, questionCount, hasVisuals]
  );

  const id = insert.rows[0].id;
  await fetchQueue().add("fetch", { documentId: id }, { jobId: `fetch:${id}:${Date.now()}` });
  await audit("document.add", {
    actorEmail: session.email,
    targetId: id,
    details: { url, subject, questionCount, hasVisuals },
  });

  return NextResponse.json({ id });
}
