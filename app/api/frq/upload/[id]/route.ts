import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isPubliclyVisibleExam, normalizeEmail } from "@/lib/moderator-auth";
import { canAccessFrqUpload } from "@/lib/frq-server";
import { getFrqCourse, getFrqCourseLabel } from "@/lib/frq-courses";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {  const auth = await getAuthUser(request);
  if (!auth.user?.email) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const email = normalizeEmail(auth.user.email);
  const supabase = createServerSupabaseAdmin();

  const allowed = await canAccessFrqUpload(supabase, id, email);
  if (!allowed) {
    return NextResponse.json({ error: "FRQ exam not found or access denied." }, { status: 403 });
  }

  const { data: upload, error: uploadError } = await supabase
    .from("frq_uploads")
    .select("*")
    .eq("id", id)
    .single();

  if (uploadError || !upload) {
    return NextResponse.json({ error: "FRQ exam not found." }, { status: 404 });
  }

  const { data: questions } = await supabase
    .from("frq_questions")
    .select("*")
    .eq("frq_upload_id", id)
    .order("question_number", { ascending: true });

  const course = getFrqCourse(upload.course_id as string);

  return NextResponse.json({
    upload: {
      id: upload.id,
      courseId: upload.course_id,
      courseLabel: getFrqCourseLabel(upload.course_id as string),
      title: upload.title,
      status: upload.status,
      questionCount: upload.question_count,
      maxScore: upload.max_score,
      sectionDurationMin: upload.section_duration_min ?? course?.sectionDurationMin ?? 90,
      sectionDirections: course?.sectionDirections ?? "",
      editorType: course?.editorType ?? "richtext",
      createdAt: upload.created_at,
      isPubliclyVisible: isPubliclyVisibleExam(upload),
      sourceType: (upload.source_type as string | null) ?? null,
      sourceName: (upload.source_name as string | null) ?? null,
      sourceUrl: (upload.source_url as string | null) ?? null,
      ownerEmail: (upload.user_email as string | null) ?? null,
    },
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      promptHtml: q.prompt_html,
      stimulusHtml: q.stimulus_html,
      parts: q.parts ?? [],
      maxPoints: q.max_points,
      pageRefs: q.page_refs ?? null,
    })),
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthUser(request);
  if (!auth.user?.email) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const email = normalizeEmail(auth.user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: upload, error: fetchError } = await supabase
    .from("frq_uploads")
    .select("id, user_email, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("frq upload delete fetch:", fetchError);
    return NextResponse.json({ error: "Could not delete FRQ exam." }, { status: 500 });
  }

  if (!upload || upload.archived_at) {
    return NextResponse.json({ error: "FRQ exam not found." }, { status: 404 });
  }

  if (normalizeEmail(upload.user_email as string) !== email) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("frq_uploads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("frq upload delete:", updateError);
    return NextResponse.json({ error: "Could not delete FRQ exam." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
