import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { getFrqCourseLabel } from "@/lib/frq-courses";

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request);
  if (!auth.user?.email) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const email = normalizeEmail(auth.user.email);
  const supabase = createServerSupabaseAdmin();

  const { data, error } = await supabase
    .from("frq_uploads")
    .select(
      "id, course_id, title, status, question_count, max_score, section_duration_min, error_message, created_at"
    )
    .eq("user_email", email)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("frq upload list:", error);
    return NextResponse.json({ error: "Could not load FRQ exams." }, { status: 500 });
  }

  const uploads = (data ?? []).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    courseLabel: getFrqCourseLabel(row.course_id as string),
    title: row.title,
    status: row.status,
    questionCount: row.question_count,
    maxScore: row.max_score,
    sectionDurationMin: row.section_duration_min,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ uploads });
}
