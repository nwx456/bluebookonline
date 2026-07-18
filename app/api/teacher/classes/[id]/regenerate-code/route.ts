import { NextRequest, NextResponse } from "next/server";
import { generateUniqueClassCode, getTeacherClass } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls || cls.archived_at) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const classCode = await generateUniqueClassCode(supabase);
  if (!classCode) {
    return NextResponse.json(
      { error: "Could not generate a unique class code." },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("classes")
    .update({ class_code: classCode })
    .eq("id", id);

  if (error) {
    console.error("regenerate-code:", error);
    return NextResponse.json({ error: "Could not regenerate code." }, { status: 500 });
  }

  return NextResponse.json({ classCode });
}
