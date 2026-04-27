import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const upd = await query(
    `UPDATE documents
       SET status = 'rejected',
           reject_reason = COALESCE(reject_reason, 'manual reject by admin')
       WHERE id = $1`,
    [id]
  );
  if (upd.rowCount === 0) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  await audit("document.reject", { actorEmail: session.email, targetId: id });
  return NextResponse.json({ ok: true, status: "rejected" });
}
