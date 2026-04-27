import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST() {
  const session = await getCurrentSession();
  await clearSessionCookie();
  if (session) {
    await audit("auth.logout", { actorEmail: session.email });
  }
  return NextResponse.json({ ok: true });
}
