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
 * GET /api/exams/wrong-answers
 * Returns wrong answers from the user's most recent attempt per exam.
 * Flat list; frontend filters by exam.
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

    const { data: allAttempts, error: attemptsError } = await supabase
      .from("attempts")
      .select("id, upload_id, completed_at")
      .eq("user_email", userEmail)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (attemptsError) {
      console.error("Wrong answers attempts fetch error:", attemptsError);
      return NextResponse.json(
        { error: "Failed to fetch wrong answers." },
        { status: 500 }
      );
    }

    const attemptList = allAttempts ?? [];
    const seenUploads = new Set<string>();
    const latestAttemptByUpload: Array<{ attemptId: string; uploadId: string; completedAt: string }> = [];
    for (const a of attemptList) {
      if (!seenUploads.has(a.upload_id)) {
        seenUploads.add(a.upload_id);
        latestAttemptByUpload.push({
          attemptId: a.id,
          uploadId: a.upload_id,
          completedAt: a.completed_at ?? new Date().toISOString(),
        });
      }
    }

    const wrongAnswers: Array<{
      uploadId: string;
      attemptId: string;
      filename: string;
      subject: string;
      completedAt: string;
      questionId: string;
      questionNumber: number;
      userAnswer: string | null;
      correctAnswer: string | null;
      questionText: string | null;
      optionA: string | null;
      optionB: string | null;
      optionC: string | null;
      optionD: string | null;
      optionE: string | null;
    }> = [];

    const uploadIds = latestAttemptByUpload.map((a) => a.uploadId);
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, subject")
      .in("id", uploadIds);
    const uploadMap = new Map(
      (uploads ?? []).map((u) => [
        u.id,
        { filename: u.filename ?? "PDF", subject: u.subject ?? "AP_CSA" },
      ])
    );

    for (const { attemptId, uploadId, completedAt } of latestAttemptByUpload) {
      const upload = uploadMap.get(uploadId);
      const filename = upload?.filename ?? "PDF";
      const subject = upload?.subject ?? "AP_CSA";

      const { data: answers } = await supabase
        .from("attempt_answers")
        .select("question_id, user_answer")
        .eq("attempt_id", attemptId)
        .eq("is_correct", false);

      const answeredWrong = (answers ?? []).filter(
        (a) => a.user_answer != null && String(a.user_answer).trim() !== ""
      );
      if (!answeredWrong.length) continue;

      const questionIds = answeredWrong.map((a) => a.question_id);
      const { data: questions } = await supabase
        .from("questions")
        .select("id, question_number, correct_answer, question_text, option_a, option_b, option_c, option_d, option_e")
        .in("id", questionIds)
        .order("question_number", { ascending: true })
        .order("id", { ascending: true });

      const questionMap = new Map(
        (questions ?? []).map((q) => [
          q.id,
          {
            questionNumber: q.question_number ?? 0,
            correctAnswer: q.correct_answer?.toString().trim().toUpperCase() ?? null,
            questionText: q.question_text ?? null,
            optionA: q.option_a ?? null,
            optionB: q.option_b ?? null,
            optionC: q.option_c ?? null,
            optionD: q.option_d ?? null,
            optionE: q.option_e ?? null,
          },
        ])
      );

      for (const a of answeredWrong) {
        const q = questionMap.get(a.question_id);
        if (!q) continue;
        wrongAnswers.push({
          uploadId,
          attemptId,
          filename,
          subject,
          completedAt,
          questionId: a.question_id,
          questionNumber: q.questionNumber,
          userAnswer: a.user_answer?.toString().trim().toUpperCase() ?? null,
          correctAnswer: q.correctAnswer,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          optionE: q.optionE,
        });
      }
    }

    wrongAnswers.sort((a, b) => {
      const dateCmp = new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      if (dateCmp !== 0) return dateCmp;
      return a.questionNumber - b.questionNumber;
    });

    return NextResponse.json({ wrongAnswers });
  } catch (err) {
    console.error("Wrong answers error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
