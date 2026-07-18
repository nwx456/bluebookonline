import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { findClassByCode, isClassMember } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const classCode = typeof body.classCode === "string" ? body.classCode : "";

  if (!classCode.trim()) {
    return NextResponse.json({ error: "Class code is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const cls = await findClassByCode(supabase, classCode);

  if (!cls || cls.archived_at) {
    return NextResponse.json({ error: "Invalid or expired class code." }, { status: 404 });
  }

  const studentEmail = normalizeEmail(user.email);

  if (normalizeEmail(cls.teacher_email) === studentEmail) {
    return NextResponse.json(
      { error: "You cannot join a class you teach." },
      { status: 400 }
    );
  }

  const alreadyMember = await isClassMember(supabase, cls.id, studentEmail);
  if (alreadyMember) {
    return NextResponse.json({
      ok: true,
      alreadyMember: true,
      class: { id: cls.id, name: cls.name },
    });
  }

  const { error } = await supabase.from("class_members").insert({
    class_id: cls.id,
    student_email: studentEmail,
  });

  if (error) {
    console.error("join class:", error);
    return NextResponse.json({ error: "Could not join class." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    class: { id: cls.id, name: cls.name, classCode: cls.class_code },
  });
}
