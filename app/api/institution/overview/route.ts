import { NextRequest, NextResponse } from "next/server";
import { countClassMembers } from "@/lib/class-server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const institutionId = auth.institution!.id;
  const supabase = createServerSupabaseAdmin();

  const [{ data: teachers }, { data: classes }] = await Promise.all([
    supabase
      .from("institution_teachers")
      .select("teacher_email")
      .eq("institution_id", institutionId)
      .eq("status", "active"),
    supabase
      .from("classes")
      .select("id")
      .eq("institution_id", institutionId)
      .is("archived_at", null),
  ]);

  const classIds = (classes ?? []).map((c) => String(c.id));
  let totalStudents = 0;

  if (classIds.length > 0) {
    const { data: members } = await supabase
      .from("class_members")
      .select("student_email")
      .in("class_id", classIds);

    const uniqueStudents = new Set(
      (members ?? []).map((m) => String(m.student_email).toLowerCase())
    );
    totalStudents = uniqueStudents.size;
  }

  return NextResponse.json({
    overview: {
      totalTeachers: (teachers ?? []).length,
      totalClasses: classIds.length,
      totalStudents,
    },
  });
}
