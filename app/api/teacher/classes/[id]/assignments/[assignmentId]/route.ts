import { NextRequest, NextResponse } from "next/server";
import { getTeacherClass } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(_request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, assignmentId } = await params;
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("class_assignments")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("class_id", id);

  if (error) {
    console.error("delete assignment:", error);
    return NextResponse.json({ error: "Could not remove assignment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
