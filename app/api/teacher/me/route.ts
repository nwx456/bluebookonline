import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";

export async function GET(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    email: normalizeEmail(auth.user!.email),
    role: "TEACHER",
  });
}
