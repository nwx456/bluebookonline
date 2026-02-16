import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { buildSolvePrompt, parseSolveResponse, type SolveQuestionInput } from "@/lib/ai-solve-prompts";
import type { SubjectKey } from "@/lib/gemini-prompts";

const BATCH_SIZE = 8;
const VALID_ANSWERS = ["A", "B", "C", "D", "E"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;

    if (!attemptId?.trim()) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, upload_id, started_at, completed_at")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (attempt.completed_at) {
      return NextResponse.json({ error: "Exam already completed." }, { status: 400 });
    }

    const { data: upload } = await supabase
      .from("pdf_uploads")
      .select("subject")
      .eq("id", attempt.upload_id)
      .single();

    const subject = (upload?.subject ?? "AP_PSYCHOLOGY") as SubjectKey;

    const { data: allQuestions } = await supabase
      .from("questions")
      .select("id, question_number, question_text, passage_text, precondition_text, option_a, option_b, option_c, option_d, option_e, correct_answer")
      .eq("upload_id", attempt.upload_id)
      .order("question_number", { ascending: true });

    if (!allQuestions?.length) {
      return NextResponse.json({ error: "No questions found." }, { status: 400 });
    }

    const questionsNeedingAi = allQuestions.filter(
      (q) => !q.correct_answer || String(q.correct_answer).trim() === ""
    ) as (typeof allQuestions[0] & { correct_answer: null })[];

    const apiKey = process.env.GEMINI_API_KEY;
    const aiAnswerMap = new Map<string, string>();

    if (questionsNeedingAi.length > 0 && apiKey?.trim()) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      for (let i = 0; i < questionsNeedingAi.length; i += BATCH_SIZE) {
        const batch = questionsNeedingAi.slice(i, i + BATCH_SIZE);
        const inputs: SolveQuestionInput[] = batch.map((q) => ({
          id: q.id,
          question_number: q.question_number,
          question_text: q.question_text,
          passage_text: q.passage_text,
          precondition_text: q.precondition_text ?? null,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
        }));

        const prompt = buildSolvePrompt(subject, inputs);
        try {
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const answers = parseSolveResponse(text, batch.length);
          batch.forEach((q, j) => {
            const ans = answers[j];
            if (ans && VALID_ANSWERS.includes(ans as (typeof VALID_ANSWERS)[number])) {
              aiAnswerMap.set(q.id, ans);
            }
          });
        } catch (err) {
          console.error("Gemini solve batch error:", err);
        }
      }
    }

    const { data: attemptAnswers } = await supabase
      .from("attempt_answers")
      .select("id, question_id, user_answer")
      .eq("attempt_id", attemptId);

    const questionCorrectMap = new Map(
      allQuestions.map((q) => [
        q.id,
        (q.correct_answer?.toString().trim().toUpperCase() || aiAnswerMap.get(q.id) || null) as string | null,
      ])
    );

    for (const aa of attemptAnswers ?? []) {
      const correctAnswer = questionCorrectMap.get(aa.question_id) ?? null;
      const userAnswer = aa.user_answer?.toString().toUpperCase().trim() || null;
      const isCorrect =
        userAnswer !== null && correctAnswer !== null && userAnswer === correctAnswer;
      const aiAnswer = aiAnswerMap.get(aa.question_id) ?? null;

      await supabase
        .from("attempt_answers")
        .update({
          ai_answer: aiAnswer,
          is_correct: isCorrect,
        })
        .eq("id", aa.id);
    }

    const answeredIds = new Set((attemptAnswers ?? []).map((a) => a.question_id));
    for (const q of allQuestions) {
      if (!answeredIds.has(q.id)) {
        const aiAnswer = aiAnswerMap.get(q.id) ?? null;
        await supabase.from("attempt_answers").insert({
          attempt_id: attemptId,
          question_id: q.id,
          user_answer: null,
          ai_answer: aiAnswer,
          is_correct: false,
        });
      }
    }

    const { data: finalAnswers } = await supabase
      .from("attempt_answers")
      .select("user_answer, is_correct")
      .eq("attempt_id", attemptId);

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    for (const a of finalAnswers ?? []) {
      if (a.user_answer == null || a.user_answer === "") {
        unansweredCount++;
      } else if (a.is_correct) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }

    const startedAt = attempt.started_at ? new Date(attempt.started_at) : new Date();
    const completedAt = new Date();
    const timeSpentSeconds = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000));

    await supabase
      .from("attempts")
      .update({
        completed_at: completedAt.toISOString(),
        time_spent_seconds: timeSpentSeconds,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unanswered_count: unansweredCount,
      })
      .eq("id", attemptId);

    const totalQuestions = allQuestions.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const { data: questionsWithAnswers } = await supabase
      .from("questions")
      .select("id, question_number, correct_answer")
      .eq("upload_id", attempt.upload_id)
      .order("question_number", { ascending: true });

    const { data: answersWithAi } = await supabase
      .from("attempt_answers")
      .select("question_id, user_answer, ai_answer, is_correct")
      .eq("attempt_id", attemptId);

    const answerByQ = new Map((answersWithAi ?? []).map((a) => [a.question_id, a]));
    const breakdown = (questionsWithAnswers ?? []).map((q) => {
      const a = answerByQ.get(q.id);
      const correctAnswer = (q.correct_answer?.toString().trim().toUpperCase() || a?.ai_answer || null) as string | null;
      return {
        questionNumber: q.question_number,
        userAnswer: a?.user_answer ?? null,
        correctAnswer,
        isCorrect: a?.is_correct ?? false,
      };
    });

    return NextResponse.json({
      ok: true,
      total: totalQuestions,
      correctCount,
      incorrectCount,
      unansweredCount,
      percentage,
      timeSpentSeconds,
      breakdown,
    });
  } catch (err) {
    console.error("exam complete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete exam." },
      { status: 500 }
    );
  }
}
