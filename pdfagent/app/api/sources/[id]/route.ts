import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled boolean required" }, { status: 400 });
  }
  const upd = await query(`UPDATE sources SET enabled = $2 WHERE id = $1`, [id, body.enabled]);
  if (upd.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit("source.toggle", {
    actorEmail: session.email,
    targetId: id,
    details: { enabled: body.enabled },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const del = await query(`DELETE FROM sources WHERE id = $1`, [id]);
  if (del.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit("source.delete", { actorEmail: session.email, targetId: id });
  return NextResponse.json({ ok: true });
}
