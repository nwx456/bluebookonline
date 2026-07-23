import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: institutionId } = await params;
  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();

  const { data: membership } = await supabase
    .from("institution_teachers")
    .select("status")
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Membership not found." }, { status: 404 });
  }

  if (membership.status === "removed") {
    return NextResponse.json({ error: "You are not a member of this institution." }, { status: 400 });
  }

  const { error } = await supabase
    .from("institution_teachers")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail);

  if (error) {
    console.error("teacher/institutions leave:", error);
    return NextResponse.json({ error: "Could not leave institution." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
