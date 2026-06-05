import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type SatModuleStat = {
  module: string;
  section: "rw" | "math";
  moduleNumber: 1 | 2;
  correct: number;
  total: number;
};

function parseModuleProgress(progress: unknown): SatModuleStat[] {
  if (!progress || typeof progress !== "object") return [];
  const order: Array<"rw1" | "rw2" | "math1" | "math2"> = ["rw1", "rw2", "math1", "math2"];
  const result: SatModuleStat[] = [];
  for (const key of order) {
    const entry = (progress as Record<string, unknown>)[key];
    if (!entry || typeof entry !== "object") continue;
    const correct = (entry as { correct?: unknown }).correct;
    const total = (entry as { total?: unknown }).total;
    if (typeof correct !== "number" || typeof total !== "number") continue;
    result.push({
      module: key,
      section: key.startsWith("math") ? "math" : "rw",
      moduleNumber: key.endsWith("2") ? 2 : 1,
      correct,
      total,
    });
  }
  return result;
}

function isSatUpload(upload: { subject?: string | null; exam_program?: string | null }): boolean {
  return (
    upload.exam_program === "SAT" ||
    upload.subject === "SAT_FULL_TEST" ||
    upload.subject === "SAT_RW" ||
    upload.subject === "SAT_MATH"
  );
}

function buildSatResult(
  upload: { subject?: string | null; exam_program?: string | null },
  satRow: {
    rw_scaled_score?: number | null;
    math_scaled_score?: number | null;
    total_scaled_score?: number | null;
    module_progress?: unknown;
  } | null
) {
  if (!isSatUpload(upload)) return null;
  const modules = parseModuleProgress(satRow?.module_progress);
  const rwScaled = satRow?.rw_scaled_score ?? null;
  const mathScaled = satRow?.math_scaled_score ?? null;
  const totalScaled = satRow?.total_scaled_score ?? null;
  if (rwScaled == null && mathScaled == null && totalScaled == null && modules.length === 0) {
    return null;
  }
  return {
    isFullTest: upload.subject === "SAT_FULL_TEST",
    rwScaled,
    mathScaled,
    totalScaled,
    modules,
  };
}

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
      "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions, skip_ai_grading, current_module_index";
    const SELECT_ATTEMPT_BASE =
      "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions, current_module_index";

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
      current_module_index?: number | null;
    };

    const first = await supabase
      .from("attempts")
      .select(SELECT_ATTEMPT_WITH_SKIP)
      .eq("id", attemptId)
      .single();

    let attempt = first.data as AttemptHeader | null | undefined;
    let attemptError = first.error;

    let hasSkipAiColumn = true;
    let hasModuleIndexColumn = true;
    if (attemptError) {
      const retryNoSkip = await supabase
        .from("attempts")
        .select(SELECT_ATTEMPT_BASE)
        .eq("id", attemptId)
        .single();
      attempt = retryNoSkip.data as AttemptHeader | null | undefined;
      attemptError = retryNoSkip.error;
      hasSkipAiColumn = false;
    }
    if (attemptError) {
      const retryLegacy = await supabase
        .from("attempts")
        .select(
          "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions, skip_ai_grading"
        )
        .eq("id", attemptId)
        .single();
      if (!retryLegacy.error && retryLegacy.data) {
        attempt = retryLegacy.data as AttemptHeader;
        attemptError = null;
        hasModuleIndexColumn = false;
      } else {
        const retryLegacy2 = await supabase
          .from("attempts")
          .select(
            "id, upload_id, user_email, completed_at, correct_count, incorrect_count, unanswered_count, time_spent_seconds, total_questions"
          )
          .eq("id", attemptId)
          .single();
        attempt = retryLegacy2.data as AttemptHeader | null | undefined;
        attemptError = retryLegacy2.error;
        hasSkipAiColumn = false;
        hasModuleIndexColumn = false;
      }
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

    const uploadId = attempt.upload_id;

    const [{ data: upload }, { data: questions }] = await Promise.all([
      supabase
        .from("pdf_uploads")
        .select(
          "id, subject, filename, storage_path, exam_program, sat_format, sat_adaptive_mode, sat_cutoff_rw, sat_cutoff_math"
        )
        .eq("id", uploadId)
        .single(),
      supabase
        .from("questions")
        .select("*")
        .eq("upload_id", uploadId)
        .order("question_number", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (!upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    if (!attempt.completed_at) {
      const { data: attemptAnswers } = await supabase
        .from("attempt_answers")
        .select("question_id, user_answer, is_flagged")
        .eq("attempt_id", attemptId);
      type InProgRow = { question_id: string; user_answer: string | null; is_flagged: boolean | null };
      const rows = (attemptAnswers ?? []) as unknown as InProgRow[];
      return NextResponse.json({
        resume: true,
        attemptId: attempt.id,
        timeSpentSeconds: attempt.time_spent_seconds ?? 0,
        currentModuleIndex: hasModuleIndexColumn ? (attempt.current_module_index ?? 0) : 0,
        upload: {
          id: upload.id,
          subject: upload.subject,
          filename: upload.filename,
          storage_path: upload.storage_path,
          exam_program: upload.exam_program,
          sat_format: upload.sat_format,
          sat_adaptive_mode: upload.sat_adaptive_mode,
          sat_cutoff_rw: upload.sat_cutoff_rw,
          sat_cutoff_math: upload.sat_cutoff_math,
        },
        questions: questions ?? [],
        savedAnswers: rows.map((a) => ({
          questionId: a.question_id,
          userAnswer: a.user_answer ?? null,
          isFlagged: a.is_flagged === true,
        })),
      });
    }

    const { data: attemptAnswers } = await supabase
      .from("attempt_answers")
      .select("question_id, user_answer, ai_answer, is_correct")
      .eq("attempt_id", attemptId);
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

    const examProgram =
      (upload as { exam_program?: string | null }).exam_program === "SAT" ? "SAT" : "AP";

    let satResult: ReturnType<typeof buildSatResult> = null;
    if (isSatUpload(upload)) {
      const { data: satRow } = await supabase
        .from("attempts")
        .select("module_progress, rw_scaled_score, math_scaled_score, total_scaled_score")
        .eq("id", attemptId)
        .single();
      satResult = buildSatResult(upload, satRow);
    }

    return NextResponse.json({
      attemptId: attempt.id,
      upload: {
        id: upload.id,
        subject: upload.subject,
        filename: upload.filename,
        storage_path: upload.storage_path,
        exam_program: (upload as { exam_program?: string | null }).exam_program ?? null,
        sat_format: (upload as { sat_format?: string | null }).sat_format ?? null,
        sat_adaptive_mode: (upload as { sat_adaptive_mode?: string | null }).sat_adaptive_mode ?? null,
        sat_cutoff_rw: (upload as { sat_cutoff_rw?: number | null }).sat_cutoff_rw ?? null,
        sat_cutoff_math: (upload as { sat_cutoff_math?: number | null }).sat_cutoff_math ?? null,
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
        examProgram,
        sat: satResult,
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
 * PATCH /api/exam/attempt/[attemptId]
 * Save elapsed time for an in-progress attempt only.
 */
export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const raw =
      (body.timeSpentSeconds ?? body.time_spent_seconds) as number | string | undefined;
    const rawModuleIndex =
      (body.currentModuleIndex ?? body.current_module_index) as number | string | undefined;
    const timeSpentSeconds =
      typeof raw === "number" && Number.isFinite(raw) && raw >= 0
        ? Math.floor(raw)
        : typeof raw === "string" && /^\d+$/.test(raw.trim())
          ? parseInt(raw.trim(), 10)
          : null;
    const currentModuleIndex =
      typeof rawModuleIndex === "number" && Number.isFinite(rawModuleIndex) && rawModuleIndex >= 0
        ? Math.floor(rawModuleIndex)
        : typeof rawModuleIndex === "string" && /^\d+$/.test(rawModuleIndex.trim())
          ? parseInt(rawModuleIndex.trim(), 10)
          : null;
    if (timeSpentSeconds === null && currentModuleIndex === null) {
      return NextResponse.json(
        { error: "timeSpentSeconds or currentModuleIndex must be provided." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, user_email, completed_at")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    const attemptUser = (attempt.user_email as string)?.trim().toLowerCase();
    if (attemptUser !== userEmail) {
      return NextResponse.json(
        { error: "You can only update your own attempts." },
        { status: 403 }
      );
    }

    if (attempt.completed_at) {
      return NextResponse.json(
        { error: "Cannot update time on a completed attempt." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (timeSpentSeconds !== null) {
      updatePayload.time_spent_seconds = timeSpentSeconds;
    }
    if (currentModuleIndex !== null) {
      updatePayload.current_module_index = currentModuleIndex;
    }

    let { error: updateError } = await supabase
      .from("attempts")
      .update(updatePayload)
      .eq("id", attemptId);

    if (updateError && currentModuleIndex !== null) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.current_module_index;
      if (Object.keys(fallbackPayload).length > 0) {
        const retry = await supabase
          .from("attempts")
          .update(fallbackPayload)
          .eq("id", attemptId);
        updateError = retry.error;
      } else {
        updateError = null;
      }
    }

    if (updateError) {
      console.error("attempt PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to save progress." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Attempt PATCH error:", err);
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
