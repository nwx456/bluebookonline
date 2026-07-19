import { NextRequest, NextResponse } from "next/server";
import { canStartExamAccess } from "@/lib/class-access";
import { resolveAssignmentExamAccess } from "@/lib/class-server";
import { isPubliclyVisibleExam } from "@/lib/moderator-auth";
import { computeSatSixModuleEffectiveCount } from "@/lib/sat-effective-question-count";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const uploadId = (body.uploadId ?? body.upload_id) as string | undefined;
    const userEmail = (body.userEmail ?? body.user_email) as string | undefined;
    const assignmentId = (body.assignmentId ?? body.assignment_id) as string | undefined;

    if (!uploadId?.trim() || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "uploadId and userEmail are required." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: upload, error: uploadError } = await supabase
      .from("pdf_uploads")
      .select("user_email, is_published, moderation_status")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Exam not found." },
        { status: 404 }
      );
    }

    const ownerEmail = (upload.user_email as string)?.trim().toLowerCase();
    const isPublished = isPubliclyVisibleExam(upload);
    const requestingEmail = userEmail.trim().toLowerCase();
    const isOwner = ownerEmail === requestingEmail;

    let resolvedAssignmentId: string | null = null;
    let hasAssignmentAccess = false;

    if (assignmentId?.trim()) {
      const access = await resolveAssignmentExamAccess(supabase, {
        assignmentId: assignmentId.trim(),
        uploadId: uploadId.trim(),
        studentEmail: requestingEmail,
      });
      hasAssignmentAccess = access.allowed;
      if (hasAssignmentAccess) {
        resolvedAssignmentId = assignmentId.trim();
      }
    }

    if (
      !canStartExamAccess({
        isOwner,
        isPublic: isPublished,
        hasAssignmentAccess,
      })
    ) {
      return NextResponse.json(
        { error: "This exam is not published. Only the owner can start it." },
        { status: 403 }
      );
    }

    const { data: questions } = await supabase
      .from("questions")
      .select("id, sat_section, sat_module, sat_module_variant")
      .eq("upload_id", uploadId)
      .order("question_number", { ascending: true })
      .order("id", { ascending: true });

    const { data: uploadMeta } = await supabase
      .from("pdf_uploads")
      .select("sat_adaptive_mode, exam_program")
      .eq("id", uploadId)
      .single();

    const totalQuestions = (() => {
      const rows = questions ?? [];
      if (uploadMeta?.exam_program !== "SAT" || rows.length === 0) return rows.length;
      if (uploadMeta.sat_adaptive_mode !== "six_module") return rows.length;
      const effective = computeSatSixModuleEffectiveCount(rows);
      return effective > 0 ? effective : rows.length;
    })();
    if (totalQuestions === 0) {
      return NextResponse.json(
        { error: "No questions found for this exam." },
        { status: 400 }
      );
    }

    const { data: attempt, error } = await supabase
      .from("attempts")
      .insert({
        user_email: userEmail.trim().toLowerCase(),
        upload_id: uploadId,
        total_questions: totalQuestions,
        ...(resolvedAssignmentId ? { assignment_id: resolvedAssignmentId } : {}),
      })
      .select("id")
      .single();

    if (error) {
      console.error("exam start insert error:", error);
      return NextResponse.json(
        { error: "Failed to start exam." },
        { status: 500 }
      );
    }

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err) {
    console.error("exam start error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start exam." },
      { status: 500 }
    );
  }
}
