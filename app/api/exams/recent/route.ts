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

const SELECT_WITH_SKIP_AI =
  "id, upload_id, completed_at, correct_count, incorrect_count, unanswered_count, total_questions, skip_ai_grading";
const SELECT_BASE =
  "id, upload_id, completed_at, correct_count, incorrect_count, unanswered_count, total_questions";

type RecentAttemptRow = {
  id: string;
  upload_id: string;
  completed_at: string;
  correct_count: number | null;
  incorrect_count: number | null;
  unanswered_count: number | null;
  total_questions: number | null;
  skip_ai_grading?: boolean | null;
};

/**
 * GET /api/exams/recent
 * Returns the user's last 3 completed exam attempts.
 * Requires Authorization: Bearer <session_token>
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: authError ?? "Unauthorized" },
        { status: 401 }
      );
    }
    const userEmail = user.email.trim().toLowerCase();

    const supabase = createServerSupabaseAdmin();

    const buildRecentQuery = (columns: string) =>
      supabase
        .from("attempts")
        .select(columns)
        .eq("user_email", userEmail)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(3);

    let { data: attempts, error: attemptsError } = await buildRecentQuery(SELECT_WITH_SKIP_AI);

    let hasSkipAiColumn = true;
    let attemptList: RecentAttemptRow[] = [];

    if (attemptsError) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[exams/recent] primary select failed, retrying without skip_ai_grading:", attemptsError.message);
      }
      const retry = await buildRecentQuery(SELECT_BASE);
      if (retry.error) {
        console.error("Recent attempts fetch error:", retry.error);
        return NextResponse.json(
          { error: "Failed to fetch recent exams." },
          { status: 500 }
        );
      }
      attemptList = (retry.data ?? []) as unknown as RecentAttemptRow[];
      hasSkipAiColumn = false;
    } else {
      attemptList = (attempts ?? []) as unknown as RecentAttemptRow[];
    }

    if (attemptList.length === 0) {
      return NextResponse.json({ attempts: [] });
    }

    const uploadIds = [...new Set(attemptList.map((a) => a.upload_id))];
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, subject")
      .in("id", uploadIds);

    const uploadMap = new Map(
      (uploads ?? []).map((u) => [u.id, { filename: u.filename ?? "PDF", subject: u.subject ?? "AP_CSA" }])
    );

    const result = attemptList.map((a) => {
      const upload = uploadMap.get(a.upload_id);
      const total = a.total_questions ?? 0;
      const correct = a.correct_count ?? 0;
      const incorrect = a.incorrect_count ?? 0;
      const unanswered = a.unanswered_count ?? 0;
      const notGradedCount = Math.max(0, total - correct - incorrect - unanswered);
      const skipAiGrading = hasSkipAiColumn
        ? (a as { skip_ai_grading?: boolean }).skip_ai_grading === true
        : notGradedCount > 0;
      const gradedAnswered = correct + incorrect;
      const percentage = skipAiGrading
        ? gradedAnswered > 0
          ? Math.round((correct / gradedAnswered) * 100)
          : null
        : total > 0
          ? Math.round((correct / total) * 100)
          : 0;
      return {
        id: a.id,
        uploadId: a.upload_id,
        filename: upload?.filename ?? "PDF",
        subject: upload?.subject ?? "AP_CSA",
        completedAt: a.completed_at,
        correctCount: correct,
        incorrectCount: incorrect,
        unansweredCount: unanswered,
        notGradedCount,
        skipAiGrading,
        totalQuestions: total,
        percentage,
      };
    });

    return NextResponse.json({ attempts: result });
  } catch (err) {
    console.error("Recent exams error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
