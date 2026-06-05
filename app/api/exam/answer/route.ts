import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { gridInAnswerMatches } from "@/lib/ai-solve-prompts";

const VALID_LETTERS = ["A", "B", "C", "D", "E"] as const;
const GRID_IN_PATTERN = /^-?[\d./]+$/;

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

    const supabase = createServerSupabaseAdmin();

    const { data: question } = await supabase
      .from("questions")
      .select("correct_answer, question_type, accepted_answers")
      .eq("id", questionId)
      .single();

    const questionType: "mcq" | "grid_in" =
      question && (question as { question_type?: string }).question_type === "grid_in"
        ? "grid_in"
        : "mcq";

    let normalizedAnswer: string | null = null;
    if (userAnswer != null && userAnswer !== "") {
      const raw = String(userAnswer).trim();
      if (questionType === "grid_in") {
        // Accept any numeric/fraction-like string; preserve case (none) and characters.
        if (!GRID_IN_PATTERN.test(raw) || !/\d/.test(raw)) {
          return NextResponse.json(
            { error: "Grid-in answer must be a numeric value (e.g. 3/2, 0.5, -2)." },
            { status: 400 }
          );
        }
        normalizedAnswer = raw;
      } else {
        const upper = raw.toUpperCase();
        if (!VALID_LETTERS.includes(upper as (typeof VALID_LETTERS)[number])) {
          return NextResponse.json(
            { error: "userAnswer must be A, B, C, D, or E." },
            { status: 400 }
          );
        }
        normalizedAnswer = upper;
      }
    }

    const correctRaw = question?.correct_answer?.toString().trim() ?? null;
    let isCorrect = false;
    if (normalizedAnswer !== null && correctRaw !== null) {
      if (questionType === "grid_in") {
        const accepted = Array.isArray((question as { accepted_answers?: unknown }).accepted_answers)
          ? ((question as { accepted_answers?: string[] }).accepted_answers as string[])
          : [];
        const allAccepted = accepted.length > 0 ? accepted : [correctRaw];
        isCorrect = gridInAnswerMatches(normalizedAnswer, allAccepted);
      } else {
        isCorrect = normalizedAnswer === correctRaw.toUpperCase();
      }
    }

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
    }
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
