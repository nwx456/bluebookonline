import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const VALID_ANSWERS = ["A", "B", "C", "D", "E"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const questionId = (body.questionId ?? body.question_id) as string | undefined;
    const userAnswer = (body.userAnswer ?? body.user_answer) as string | null | undefined;
    const isFlagged = body.isFlagged ?? body.is_flagged ?? false;

    if (!attemptId?.trim() || !questionId?.trim()) {
      return NextResponse.json(
        { error: "attemptId and questionId are required." },
        { status: 400 }
      );
    }

    const normalizedAnswer =
      userAnswer != null && userAnswer !== ""
        ? String(userAnswer).toUpperCase().trim()
        : null;
    if (
      normalizedAnswer !== null &&
      !VALID_ANSWERS.includes(normalizedAnswer as (typeof VALID_ANSWERS)[number])
    ) {
      return NextResponse.json(
        { error: "userAnswer must be A, B, C, D, or E." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: question } = await supabase
      .from("questions")
      .select("correct_answer")
      .eq("id", questionId)
      .single();

    const correctAnswer = question?.correct_answer?.toString().toUpperCase().trim() ?? null;
    const isCorrect =
      normalizedAnswer !== null && correctAnswer !== null && normalizedAnswer === correctAnswer;

    const { data: existing } = await supabase
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("attempt_answers")
        .update({
          user_answer: normalizedAnswer,
          is_flagged: !!isFlagged,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        })
        .eq("attempt_id", attemptId)
        .eq("question_id", questionId);

      if (updateError) {
        console.error("exam answer update error:", updateError);
        return NextResponse.json(
          { error: "Failed to save answer." },
          { status: 500 }
        );
    } else {
      const { error: insertError } = await supabase.from("attempt_answers").insert({
        attempt_id: attemptId,
        question_id: questionId,
        user_answer: normalizedAnswer,
        is_flagged: !!isFlagged,
        is_correct: isCorrect,
      });

      if (insertError) {
        console.error("exam answer insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to save answer." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("exam answer error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save answer." },
      { status: 500 }
    );
  }
}
