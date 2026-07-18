import { NextRequest, NextResponse } from "next/server";
import { getTeacherClass } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string; email: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(_request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, email: emailParam } = await params;
  const studentEmail = normalizeEmail(decodeURIComponent(emailParam));
  if (!studentEmail) {
    return NextResponse.json({ error: "Invalid student email." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", id)
    .eq("student_email", studentEmail);

  if (error) {
    console.error("remove member:", error);
    return NextResponse.json({ error: "Could not remove student." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
