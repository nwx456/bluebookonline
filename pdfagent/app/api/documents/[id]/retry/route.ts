import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { fetchQueue, uploadQueue } from "@/lib/queue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { rows } = await query<{ status: string; pdf_path: string | null }>(
    `SELECT status, pdf_path FROM documents WHERE id = $1`,
    [id]
  );
  const doc = rows[0];
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.pdf_path) {
    await query(`UPDATE documents SET status = 'queued_upload' WHERE id = $1`, [id]);
    await uploadQueue().add("upload", { documentId: id }, { jobId: `upload:${id}:retry:${Date.now()}` });
    await audit("document.retry.upload", { actorEmail: session.email, targetId: id });
    return NextResponse.json({ ok: true, status: "queued_upload" });
  }
  await query(`UPDATE documents SET status = 'discovered', reject_reason = NULL WHERE id = $1`, [id]);
  await fetchQueue().add("fetch", { documentId: id }, { jobId: `fetch:${id}:retry:${Date.now()}` });
  await audit("document.retry.fetch", { actorEmail: session.email, targetId: id });
  return NextResponse.json({ ok: true, status: "discovered" });
}
