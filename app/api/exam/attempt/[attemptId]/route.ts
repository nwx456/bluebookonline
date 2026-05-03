import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token)
    return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    return {
      user: null,
      error: "Invalid or expired session. Please sign in again.",
    };
  return { user, error: null };
}

/**
 * GET /api/exam/attempt/[attemptId]
 * Returns attempt details for review mode: upload, questions, breakdown.
 * Only the attempt owner can access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    if (!attemptId?.trim()) {
      return NextResponse.json(
        { error: "Attempt ID is required." },
        { status: 400 }
      );
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: authError ?? "Unauthorized" },
        { status: 401 }
      );
    }
    const userEmail = user.email.trim().toLowerCase();

    const supabase = createServerSupabaseAdmin();

    const SELECT_ATTEMPT_WITH_SKIP =
      "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions, skip_ai_grading";
    const SELECT_ATTEMPT_BASE =
      "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions";

    type AttemptHeader = {
      id: string;
      upload_id: string;
      user_email: string;
      completed_at: string | null;
      correct_count: number | null;
      incorrect_count: number | null;
      unanswered_count: number | null;
      time_spent_seconds: number | null;
      total_questions: number | null;
      skip_ai_grading?: boolean | null;
    };

    const first = await supabase
      .from("attempts")
      .select(SELECT_ATTEMPT_WITH_SKIP)
      .eq("id", attemptId)
      .single();

    let attempt = first.data as AttemptHeader | null | undefined;
    let attemptError = first.error;

    let hasSkipAiColumn = true;
    if (attemptError) {
      const retry = await supabase
        .from("attempts")
        .select(SELECT_ATTEMPT_BASE)
        .eq("id", attemptId)
        .single();
      attempt = retry.data as AttemptHeader | null | undefined;
      attemptError = retry.error;
      hasSkipAiColumn = false;
    }

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const attemptUser = (attempt.user_email as string)?.trim().toLowerCase();
    if (attemptUser !== userEmail) {
      return NextResponse.json(
        { error: "You can only view your own attempts." },
        { status: 403 }
      );
    }

    if (!attempt.completed_at) {
      return NextResponse.json(
        { error: "Attempt is not completed." },
        { status: 400 }
      );
    }

    const uploadId = attempt.upload_id;

    const [{ data: upload }, { data: questions }, { data: attemptAnswers }] =
      await Promise.all([
        supabase
          .from("pdf_uploads")
          .select("id, subject, filename, storage_path")
          .eq("id", uploadId)
          .single(),
        supabase
          .from("questions")
          .select("*")
          .eq("upload_id", uploadId)
          .order("question_number", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("attempt_answers")
          .select("question_id, user_answer, ai_answer, is_correct")
          .eq("attempt_id", attemptId),
      ]);

    if (!upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const answerByQ = new Map(
      (attemptAnswers ?? []).map((a) => [a.question_id, a])
    );
    const questionsWithAnswers = (questions ?? []).map((q) => {
      const a = answerByQ.get(q.id);
      const correctAnswer =
        (q.correct_answer?.toString().trim().toUpperCase() ||
          a?.ai_answer ||
          null) as string | null;
      return {
        questionNumber: q.question_number,
        userAnswer: a?.user_answer ?? null,
        correctAnswer,
        isCorrect: a?.is_correct ?? false,
      };
    });

    const totalQuestions = attempt.total_questions ?? questions?.length ?? 0;
    const correctCount = attempt.correct_count ?? 0;
    const incorrectCount = attempt.incorrect_count ?? 0;
    const unansweredCount = attempt.unanswered_count ?? 0;
    const notGradedCount = Math.max(0, totalQuestions - correctCount - incorrectCount - unansweredCount);
    const skipAiGrading = hasSkipAiColumn
      ? (attempt as { skip_ai_grading?: boolean }).skip_ai_grading === true
      : notGradedCount > 0;
    const gradedAnswered = correctCount + incorrectCount;
    const percentage = skipAiGrading
      ? gradedAnswered > 0
        ? Math.round((correctCount / gradedAnswered) * 100)
        : 0
      : totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;

    return NextResponse.json({
      upload: {
        id: upload.id,
        subject: upload.subject,
        filename: upload.filename,
        storage_path: upload.storage_path,
      },
      questions: questions ?? [],
      result: {
        total: totalQuestions,
        correctCount,
        incorrectCount,
        unansweredCount,
        notGradedCount,
        skipAiGrading,
        percentage,
        timeSpentSeconds: attempt.time_spent_seconds ?? 0,
        breakdown: questionsWithAnswers,
      },
    });
  } catch (err) {
    console.error("Attempt fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exam/attempt/[attemptId]
 * Removes this attempt and its attempt_answers only (does not delete the exam PDF).
 * Only the attempt owner can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    if (!attemptId?.trim()) {
      return NextResponse.json(
        { error: "Attempt ID is required." },
        { status: 400 }
      );
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: authError ?? "Unauthorized" },
        { status: 401 }
      );
    }
    const userEmail = user.email.trim().toLowerCase();

    const supabase = createServerSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, user_email")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const attemptUser = (attempt.user_email as string)?.trim().toLowerCase();
    if (attemptUser !== userEmail) {
      return NextResponse.json(
        { error: "You can only delete your own attempts." },
        { status: 403 }
      );
    }

    const { error: answersError } = await supabase
      .from("attempt_answers")
      .delete()
      .eq("attempt_id", attemptId);

    if (answersError) {
      console.error("attempt_answers delete error:", answersError);
      return NextResponse.json(
        { error: "Failed to delete attempt answers." },
        { status: 500 }
      );
    }

    const { error: deleteAttemptError } = await supabase
      .from("attempts")
      .delete()
      .eq("id", attemptId);

    if (deleteAttemptError) {
      console.error("attempt delete error:", deleteAttemptError);
      return NextResponse.json(
        { error: "Failed to delete attempt." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Attempt delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
