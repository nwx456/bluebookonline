import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isPubliclyVisibleExam, normalizeEmail } from "@/lib/moderator-auth";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import {
  comparePartLabels,
  flattenFrqParts,
  formatFrqPartDisplayLabel,
  getExamMaxScore,
  getPartMaxPoints,
  normalizeFrqParts,
  type FrqQuestionRow,
} from "@/lib/frq-server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthUser(request);
  if (!auth.user?.email) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const email = normalizeEmail(auth.user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: attempt } = await supabase
    .from("frq_attempts")
    .select("*")
    .eq("id", id)
    .single();

  if (!attempt || normalizeEmail(attempt.user_email as string) !== email) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const { data: upload } = await supabase
    .from("frq_uploads")
    .select("*")
    .eq("id", attempt.frq_upload_id)
    .single();

  const { data: questions } = await supabase
    .from("frq_questions")
    .select("*")
    .eq("frq_upload_id", attempt.frq_upload_id)
    .order("question_number", { ascending: true });

  const { data: responses } = await supabase
    .from("frq_responses")
    .select("*")
    .eq("attempt_id", id);

  const questionRows = (questions ?? []) as FrqQuestionRow[];
  const computedMaxScore = getExamMaxScore(questionRows);
  const responseByKey = new Map(
    (responses ?? []).map((r) => [
      `${r.question_id}::${r.part_label ?? ""}`,
      r,
    ])
  );

  const orderedResponses: Array<{
    questionId: string;
    questionNumber: number;
    partLabel: string;
    displayLabel: string;
    partPrompt: string;
    maxPoints: number;
    responseText: string;
    isFlagged: boolean;
    score: number | null;
    rubricBreakdown: unknown;
    aiFeedback: string | null;
    strengths: string[] | null;
    improvements: string[] | null;
  }> = [];

  for (const q of questionRows) {
    const parts = normalizeFrqParts(q.parts);
    for (const part of parts) {
      const label = part.label ?? "";
      const partDisplayLabel = part.display_label?.trim() || null;
      const key = `${q.id}::${label}`;
      const r = responseByKey.get(key);
      orderedResponses.push({
        questionId: q.id,
        questionNumber: q.question_number,
        partLabel: label,
        displayLabel: formatFrqPartDisplayLabel(q.question_number, label, partDisplayLabel),
        partPrompt: part.prompt ?? "",
        maxPoints: getPartMaxPoints(q, label),
        responseText: (r?.response_text as string) ?? "",
        isFlagged: Boolean(r?.is_flagged),
        score: r?.score != null ? Number(r.score) : null,
        rubricBreakdown: r?.rubric_breakdown ?? null,
        aiFeedback: (r?.ai_feedback as string | null) ?? null,
        strengths: Array.isArray(r?.strengths) ? (r.strengths as string[]) : null,
        improvements: Array.isArray(r?.improvements) ? (r.improvements as string[]) : null,
      });
    }
  }

  orderedResponses.sort((a, b) => {
    if (a.questionNumber !== b.questionNumber) {
      return a.questionNumber - b.questionNumber;
    }
    return comparePartLabels(a.partLabel, b.partLabel);
  });

  const totalScoreFromParts = orderedResponses.reduce(
    (sum, r) => sum + (r.score ?? 0),
    0
  );

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      status: attempt.status,
      totalScore: attempt.total_score ?? totalScoreFromParts,
      maxScore: computedMaxScore || Number(attempt.max_score) || 0,
      startedAt: attempt.started_at,
      completedAt: attempt.completed_at,
      gradedAt: attempt.graded_at,
    },
    upload: upload
      ? {
          id: upload.id,
          title: upload.title,
          courseId: upload.course_id,
          courseLabel: getFrqCourseLabel(upload.course_id as string),
          isPubliclyVisible: isPubliclyVisibleExam(upload),
          sourceType: (upload.source_type as string | null) ?? null,
          sourceName: (upload.source_name as string | null) ?? null,
          sourceUrl: (upload.source_url as string | null) ?? null,
        }
      : null,
    questions: questionRows.map((q) => ({
      id: q.id,
      questionNumber: q.question_number,
      questionType: q.question_type,
      promptHtml: q.prompt_html,
      stimulusHtml: q.stimulus_html,
      parts: q.parts ?? [],
      maxPoints: q.max_points,
    })),
    flatParts: flattenFrqParts(questionRows),
    responses: orderedResponses,
  });
}

/**
 * DELETE /api/frq/exam/attempt/[id]
 * Removes this FRQ attempt and its responses only (does not delete the FRQ exam upload).
 * Only the attempt owner can delete.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthUser(request);
    if (!auth.user?.email) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Attempt ID is required." }, { status: 400 });
    }

    const email = normalizeEmail(auth.user.email);
    const supabase = createServerSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from("frq_attempts")
      .select("id, user_email")
      .eq("id", id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (normalizeEmail(attempt.user_email as string) !== email) {
      return NextResponse.json(
        { error: "You can only delete your own attempts." },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase.from("frq_attempts").delete().eq("id", id);

    if (deleteError) {
      console.error("frq_attempt delete error:", deleteError);
      return NextResponse.json({ error: "Failed to delete attempt." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("FRQ attempt delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
