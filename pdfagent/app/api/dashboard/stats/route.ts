import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { rows } = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM documents GROUP BY status`
  );
  const total = rows.reduce((s, r) => s + Number(r.count), 0);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  return NextResponse.json({ total, byStatus });
}
