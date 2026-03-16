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
 * GET /api/exams/recent
 * Returns the user's last 5 completed exam attempts.
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

    const { data: attempts, error: attemptsError } = await supabase
      .from("attempts")
      .select("id, upload_id, completed_at, correct_count, incorrect_count, total_questions")
      .eq("user_email", userEmail)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(5);

    if (attemptsError) {
      console.error("Recent attempts fetch error:", attemptsError);
      return NextResponse.json(
        { error: "Failed to fetch recent exams." },
        { status: 500 }
      );
    }

    const attemptList = attempts ?? [];
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
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        id: a.id,
        uploadId: a.upload_id,
        filename: upload?.filename ?? "PDF",
        subject: upload?.subject ?? "AP_CSA",
        completedAt: a.completed_at,
        correctCount: a.correct_count ?? 0,
        incorrectCount: a.incorrect_count ?? 0,
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
