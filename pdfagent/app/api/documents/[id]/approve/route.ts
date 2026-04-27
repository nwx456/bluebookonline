import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { uploadQueue } from "@/lib/queue";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const upd = await query<{ status: string }>(
    `UPDATE documents SET status = 'queued_upload'
       WHERE id = $1 AND status = 'pending_review'
     RETURNING status`,
    [id]
  );
  if (upd.rowCount === 0) {
    return NextResponse.json({ error: "Document not in pending_review" }, { status: 400 });
  }
  await uploadQueue().add("upload", { documentId: id }, { jobId: `upload:${id}:${Date.now()}` });
  await audit("document.approve", { actorEmail: session.email, targetId: id });
  return NextResponse.json({ ok: true, status: "queued_upload" });
}
