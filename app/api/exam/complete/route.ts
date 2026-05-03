import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { buildSolvePromptWithOptionalPdf, parseSolveResponse, type SolveQuestionInput } from "@/lib/ai-solve-prompts";
import type { SubjectKey } from "@/lib/gemini-prompts";
import { generateWithFallback } from "@/lib/gemini-client";

const BATCH_SIZE = 8;
const VALID_ANSWERS = ["A", "B", "C", "D", "E"] as const;
const PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

async function downloadPdfAsBase64(
  supabase: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
  uploadId: string,
  storagePath: string | null
): Promise<string | null> {
  if (!storagePath?.trim() || !storagePath.endsWith(".pdf")) return null;
  try {
    const { data, error } = await supabase.storage.from("pdf_uploads").download(storagePath);
    if (error && storagePath.startsWith("pending/")) {
      const fallbackPath = `${uploadId}.pdf`;
      const fallback = await supabase.storage.from("pdf_uploads").download(fallbackPath);
      if (fallback.error || !fallback.data) return null;
      if (fallback.data.size > PDF_MAX_SIZE_BYTES) return null;
      return Buffer.from(await fallback.data.arrayBuffer()).toString("base64");
    }
    if (error || !data) return null;
    if (data.size > PDF_MAX_SIZE_BYTES) return null;
    return Buffer.from(await data.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const skipAiGrading = body.skipAiGrading === true || body.skip_ai_grading === true;

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
      .select("subject, storage_path")
      .eq("id", attempt.upload_id)
      .single();

    const subject = (upload?.subject ?? "AP_PSYCHOLOGY") as SubjectKey;

    const { data: allQuestions } = await supabase
      .from("questions")
      .select("id, question_number, question_text, passage_text, precondition_text, option_a, option_b, option_c, option_d, option_e, correct_answer, page_number, has_graph, bbox")
      .eq("upload_id", attempt.upload_id)
      .order("question_number", { ascending: true })
      .order("id", { ascending: true });

    if (!allQuestions?.length) {
      return NextResponse.json({ error: "No questions found." }, { status: 400 });
    }

    const aiAnswerMap = new Map<string, string>();

    if (!skipAiGrading) {
      const questionsNeedingAi = allQuestions.filter(
        (q) => !q.correct_answer || String(q.correct_answer).trim() === ""
      ) as (typeof allQuestions[0] & { correct_answer: null })[];

      const apiKey = process.env.GEMINI_API_KEY;
      const batchHasGraph = questionsNeedingAi.some((q) => q.has_graph === true);
      let pdfBase64: string | null = null;
      if (batchHasGraph && upload?.storage_path) {
        pdfBase64 = await downloadPdfAsBase64(supabase, attempt.upload_id, upload.storage_path);
      }

      if (questionsNeedingAi.length > 0 && apiKey?.trim()) {
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
            page_number: q.page_number ?? null,
            has_graph: q.has_graph ?? false,
            bbox: q.bbox as { x: number; y: number; width: number; height: number } | null ?? null,
          }));

          const { prompt, usePdf } = buildSolvePromptWithOptionalPdf(subject, inputs, pdfBase64);
          const runBatch = async (isRetry = false): Promise<boolean> => {
            const contents = usePdf && pdfBase64
              ? [
                  { text: prompt },
                  { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                ]
              : prompt;
            const { text } = await generateWithFallback({ apiKey, contents });
            if (!text?.trim()) {
              if (process.env.NODE_ENV === "development") {
                console.warn("[exam/complete] Gemini returned empty response for batch", i);
              }
              return false;
            }
            const answers = parseSolveResponse(text, batch.length);
            const parsedCount = answers.filter((a) => a != null).length;
            if (parsedCount === 0 && process.env.NODE_ENV === "development") {
              console.warn("[exam/complete] parseSolveResponse got no valid answers. Raw:", text.slice(0, 300));
            }
            const allSame =
              batch.length > 1 &&
              parsedCount === batch.length &&
              answers.every((a) => a === answers[0]);
            if (allSame && !isRetry && process.env.NODE_ENV === "development") {
              console.warn("[exam/complete] All answers same for batch - possible parse error, will retry. Raw:", text.slice(0, 300));
            }
            if (allSame) {
              if (!isRetry) return true;
              return false;
            }
            batch.forEach((q, j) => {
              const ans = answers[j];
              if (ans && VALID_ANSWERS.includes(ans as (typeof VALID_ANSWERS)[number])) {
                aiAnswerMap.set(q.id, ans);
              }
            });
            return false;
          };
          try {
            const shouldRetry = await runBatch();
            if (shouldRetry) {
              await runBatch(true);
            }
          } catch (err) {
            console.error("Gemini solve batch error:", err);
            try {
              await runBatch(true);
            } catch (retryErr) {
              console.error("Gemini solve batch retry error:", retryErr);
            }
          }
        }
      }

      for (const [qId, ans] of aiAnswerMap) {
        await supabase.from("questions").update({ correct_answer: ans }).eq("id", qId);
      }
    }

    const { data: attemptAnswers } = await supabase
      .from("attempt_answers")
      .select("id, question_id, user_answer")
      .eq("attempt_id", attemptId);

    const questionCorrectMap = new Map(
      allQuestions.map((q) => [
        q.id,
        skipAiGrading
          ? ((q.correct_answer?.toString().trim().toUpperCase() || null) as string | null)
          : ((q.correct_answer?.toString().trim().toUpperCase() || aiAnswerMap.get(q.id) || null) as string | null),
      ])
    );

    for (const aa of attemptAnswers ?? []) {
      const correctAnswer = questionCorrectMap.get(aa.question_id) ?? null;
      const userAnswer = aa.user_answer?.toString().toUpperCase().trim() || null;
      const isCorrect =
        userAnswer !== null && correctAnswer !== null && userAnswer === correctAnswer;
      const aiAnswer = skipAiGrading ? null : (aiAnswerMap.get(aa.question_id) ?? null);

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
        const aiAnswer = skipAiGrading ? null : (aiAnswerMap.get(q.id) ?? null);
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
      .select("question_id, user_answer, is_correct")
      .eq("attempt_id", attemptId);

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let notGradedCount = 0;

    if (skipAiGrading) {
      for (const a of finalAnswers ?? []) {
        const key = questionCorrectMap.get(a.question_id) ?? null;
        const user = a.user_answer?.toString().toUpperCase().trim() || null;
        if (user === null || user === "") {
          unansweredCount++;
        } else if (key === null || key === "") {
          notGradedCount++;
        } else if (user === key) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    } else {
      for (const a of finalAnswers ?? []) {
        if (a.user_answer == null || a.user_answer === "") {
          unansweredCount++;
        } else if (a.is_correct) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    }

    const startedAt = attempt.started_at ? new Date(attempt.started_at) : new Date();
    const completedAt = new Date();
    const timeSpentSeconds = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000));

    const gradedAnswered = correctCount + incorrectCount;
    const percentage =
      skipAiGrading
        ? gradedAnswered > 0
          ? Math.round((correctCount / gradedAnswered) * 100)
          : 0
        : allQuestions.length > 0
          ? Math.round((correctCount / allQuestions.length) * 100)
          : 0;

    const attemptUpdateBase = {
      completed_at: completedAt.toISOString(),
      time_spent_seconds: timeSpentSeconds,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unanswered_count: unansweredCount,
    };

    const { error: attemptUpdateError } = await supabase
      .from("attempts")
      .update({ ...attemptUpdateBase, skip_ai_grading: skipAiGrading })
      .eq("id", attemptId);

    if (attemptUpdateError) {
      await supabase.from("attempts").update(attemptUpdateBase).eq("id", attemptId);
    }

    const totalQuestions = allQuestions.length;

    const { data: questionsWithAnswers } = await supabase
      .from("questions")
      .select("id, question_number, correct_answer")
      .eq("upload_id", attempt.upload_id)
      .order("question_number", { ascending: true })
      .order("id", { ascending: true });

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
      notGradedCount,
      skipAiGrading,
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
