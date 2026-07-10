import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  buildSolvePromptWithOptionalPdf,
  parseSolveResponse,
  gridInAnswerMatches,
  type SolveQuestionInput,
} from "@/lib/ai-solve-prompts";
import type { SubjectKey } from "@/lib/gemini-prompts";
import { generateWithFallback } from "@/lib/gemini-client";
import {
  SAT_MODULES,
  type SatModuleId,
  type SatModuleVariant,
  type SatSection,
} from "@/lib/exam-program";

export const GRADE_BATCH_SIZE = 8;
const VALID_ANSWERS = ["A", "B", "C", "D", "E"] as const;
const PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024;

export type GradeQuestionRow = {
  id: string;
  question_number: number;
  question_text: string | null;
  passage_text: string | null;
  precondition_text?: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
  page_number?: number | null;
  has_graph?: boolean | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  question_type?: string | null;
  accepted_answers?: string[] | null;
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
};

export type BreakdownRow = {
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
};

export type GradeCounts = {
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  notGradedCount: number;
  percentage: number;
};

type QuestionMeta = {
  qtype: "mcq" | "grid_in";
  correct: string | null;
  accepted: string[];
};

export async function downloadPdfAsBase64(
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

export async function runAiGradingForQuestions(
  subject: SubjectKey,
  questions: GradeQuestionRow[],
  storagePath: string | null,
  uploadId: string,
  supabase: Awaited<ReturnType<typeof createServerSupabaseAdmin>>
): Promise<Map<string, string>> {
  const aiAnswerMap = new Map<string, string>();
  const questionsNeedingAi = questions.filter(
    (q) => !q.correct_answer || String(q.correct_answer).trim() === ""
  );

  const apiKey = process.env.GEMINI_API_KEY;
  const batchHasGraph = questionsNeedingAi.some((q) => q.has_graph === true);
  let pdfBase64: string | null = null;
  if (batchHasGraph && storagePath) {
    pdfBase64 = await downloadPdfAsBase64(supabase, uploadId, storagePath);
  }

  if (questionsNeedingAi.length === 0 || !apiKey?.trim()) {
    return aiAnswerMap;
  }

  for (let i = 0; i < questionsNeedingAi.length; i += GRADE_BATCH_SIZE) {
    const batch = questionsNeedingAi.slice(i, i + GRADE_BATCH_SIZE);
    const inputs: SolveQuestionInput[] = batch.map((q) => ({
      id: q.id,
      question_number: q.question_number,
      question_text: q.question_text ?? "",
      passage_text: q.passage_text,
      precondition_text: q.precondition_text ?? null,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e,
      page_number: q.page_number ?? null,
      has_graph: q.has_graph ?? false,
      bbox: q.bbox ?? null,
      question_type: (q.question_type === "grid_in" ? "grid_in" : "mcq") as "mcq" | "grid_in",
    }));

    const { prompt, usePdf } = buildSolvePromptWithOptionalPdf(subject, inputs, pdfBase64);
    const runBatch = async (isRetry = false): Promise<boolean> => {
      const contents =
        usePdf && pdfBase64
          ? [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }]
          : prompt;
      const { text } = await generateWithFallback({ apiKey, contents });
      if (!text?.trim()) return false;
      const answers = parseSolveResponse(text, batch.length);
      const parsedCount = answers.filter((a) => a != null).length;
      const allSame =
        batch.length > 1 && parsedCount === batch.length && answers.every((a) => a === answers[0]);
      if (allSame) {
        if (!isRetry) return true;
        return false;
      }
      batch.forEach((q, j) => {
        const ans = answers[j];
        if (!ans) return;
        const isGridIn = q.question_type === "grid_in";
        if (isGridIn) {
          if (typeof ans === "string" && ans.trim() !== "") {
            aiAnswerMap.set(q.id, ans.trim());
          }
        } else if (VALID_ANSWERS.includes(ans as (typeof VALID_ANSWERS)[number])) {
          aiAnswerMap.set(q.id, ans);
        }
      });
      return false;
    };
    try {
      const shouldRetry = await runBatch();
      if (shouldRetry) await runBatch(true);
    } catch (err) {
      console.error("Gemini solve batch error:", err);
      try {
        await runBatch(true);
      } catch (retryErr) {
        console.error("Gemini solve batch retry error:", retryErr);
      }
    }
  }

  for (const [qId, ans] of aiAnswerMap) {
    await supabase.from("questions").update({ correct_answer: ans }).eq("id", qId);
  }

  return aiAnswerMap;
}

export function buildQuestionMeta(
  questions: GradeQuestionRow[],
  aiAnswerMap: Map<string, string>,
  skipAiGrading: boolean
): Map<string, QuestionMeta> {
  return new Map(
    questions.map((q) => {
      const qtype = (q.question_type === "grid_in" ? "grid_in" : "mcq") as "mcq" | "grid_in";
      const rawCorrect = q.correct_answer?.toString().trim() ?? "";
      const aiCorrect = aiAnswerMap.get(q.id) ?? null;
      const fallbackCorrect = rawCorrect || aiCorrect || null;
      const normalizedCorrect =
        qtype === "mcq" && fallbackCorrect ? fallbackCorrect.toUpperCase() : fallbackCorrect;
      const accepted = Array.isArray(q.accepted_answers) ? q.accepted_answers : [];
      return [
        q.id,
        {
          qtype,
          correct: skipAiGrading
            ? qtype === "mcq"
              ? rawCorrect.toUpperCase() || null
              : rawCorrect || null
            : normalizedCorrect,
          accepted,
        },
      ] as const;
    })
  );
}

export function checkAnswerWithMeta(
  questionMeta: Map<string, QuestionMeta>,
  qId: string,
  userAnswerRaw: string | null
): boolean {
  const meta = questionMeta.get(qId);
  if (!meta || !meta.correct || !userAnswerRaw) return false;
  const userTrim = userAnswerRaw.trim();
  if (!userTrim) return false;
  if (meta.qtype === "grid_in") {
    const accepted = meta.accepted.length > 0 ? meta.accepted : [meta.correct];
    return gridInAnswerMatches(userTrim, accepted);
  }
  return userTrim.toUpperCase() === meta.correct;
}

export function computeGradeCounts(
  questionIds: Set<string>,
  questionMeta: Map<string, QuestionMeta>,
  finalAnswers: Array<{ question_id: string; user_answer: string | null; is_correct: boolean | null }>,
  skipAiGrading: boolean,
  percentageDenominator: number
): GradeCounts {
  const questionCorrectMap = new Map(
    Array.from(questionMeta.entries()).map(([id, meta]) => [id, meta.correct])
  );

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let notGradedCount = 0;

  const scoped = finalAnswers.filter((a) => questionIds.has(a.question_id));

  if (skipAiGrading) {
    for (const a of scoped) {
      const key = questionCorrectMap.get(a.question_id) ?? null;
      const user = a.user_answer?.toString().trim() || null;
      if (user === null || user === "") {
        unansweredCount++;
      } else if (key === null || key === "") {
        notGradedCount++;
      } else if (checkAnswerWithMeta(questionMeta, a.question_id, user)) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
  } else {
    for (const a of scoped) {
      if (a.user_answer == null || a.user_answer === "") {
        unansweredCount++;
      } else if (a.is_correct) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
  }

  const gradedAnswered = correctCount + incorrectCount;
  const percentage = skipAiGrading
    ? gradedAnswered > 0
      ? Math.round((correctCount / gradedAnswered) * 100)
      : 0
    : percentageDenominator > 0
      ? Math.round((correctCount / percentageDenominator) * 100)
      : 0;

  return { correctCount, incorrectCount, unansweredCount, notGradedCount, percentage };
}

export function buildBreakdown(
  questions: GradeQuestionRow[],
  answerByQ: Map<
    string,
    { user_answer: string | null; ai_answer: string | null; is_correct: boolean | null }
  >
): BreakdownRow[] {
  return questions.map((q) => {
    const a = answerByQ.get(q.id);
    const rawCorrect = q.correct_answer?.toString().trim() ?? "";
    const correctAnswer = (
      rawCorrect ? rawCorrect.toUpperCase() : a?.ai_answer || null
    ) as string | null;
    return {
      questionNumber: q.question_number,
      userAnswer: a?.user_answer ?? null,
      correctAnswer,
      isCorrect: a?.is_correct ?? false,
    };
  });
}

export function filterQuestionsForSatModule(
  questions: GradeQuestionRow[],
  moduleId: SatModuleId,
  opts: {
    /**
     * When true, apply strict section/module filtering. This should be true for
     * SAT full tests AND section tests (any upload that uses the module flow).
     * Single-module uploads should pass false and receive all questions.
     */
    isSatFull: boolean;
    satAdaptiveMode: string | null | undefined;
    selectedRwM2Variant: SatModuleVariant | null;
    selectedMathM2Variant: SatModuleVariant | null;
  }
): GradeQuestionRow[] {
  if (!opts.isSatFull) return questions;
  const target = SAT_MODULES.find((m) => m.id === moduleId);
  if (!target) return [];
  return questions.filter((q) => {
    // STRICT match: a question without an explicit section or module MUST be
    // excluded rather than silently attached to "rw"/"1". Extraction is
    // responsible for tagging every row. Trim + lowercase to defend against
    // stray whitespace/casing from AI responses.
    const rawSection =
      typeof q.sat_section === "string"
        ? q.sat_section.toLowerCase().trim()
        : null;
    if (rawSection !== "rw" && rawSection !== "math") return false;
    const section = rawSection as SatSection;
    const moduleNumber = q.sat_module === 1 || q.sat_module === 2 ? q.sat_module : null;
    if (moduleNumber == null) return false;
    if (section !== target.section || moduleNumber !== target.module) return false;

    // In six-module adaptive mode, M2 must match the selected easy/hard variant
    // for that section. A question tagged with a different variant is out;
    // a null variant on an M2 question in six_module is a data problem — drop.
    if (target.module === 2 && opts.satAdaptiveMode === "six_module") {
      const variant =
        target.section === "rw"
          ? opts.selectedRwM2Variant
          : opts.selectedMathM2Variant;
      if (!variant) return false;
      if (q.sat_module_variant !== variant) return false;
    }
    return true;
  });
}

/** Grade a question subset and persist attempt_answers for those questions only. */
export async function gradeAndPersistQuestionSubset(params: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseAdmin>>;
  attemptId: string;
  subject: SubjectKey;
  storagePath: string | null;
  uploadId: string;
  questions: GradeQuestionRow[];
  skipAiGrading: boolean;
  insertMissingAnswers?: boolean;
}): Promise<{
  breakdown: BreakdownRow[];
  counts: GradeCounts;
}> {
  const {
    supabase,
    attemptId,
    subject,
    storagePath,
    uploadId,
    questions,
    skipAiGrading,
    insertMissingAnswers = true,
  } = params;

  const questionIdSet = new Set(questions.map((q) => q.id));

  const aiAnswerMap = skipAiGrading
    ? new Map<string, string>()
    : await runAiGradingForQuestions(subject, questions, storagePath, uploadId, supabase);

  const questionMeta = buildQuestionMeta(questions, aiAnswerMap, skipAiGrading);

  const { data: attemptAnswers } = await supabase
    .from("attempt_answers")
    .select("id, question_id, user_answer")
    .eq("attempt_id", attemptId);

  for (const aa of attemptAnswers ?? []) {
    if (!questionIdSet.has(aa.question_id)) continue;
    const userAnswerRaw = aa.user_answer?.toString().trim() || null;
    const isCorrect = checkAnswerWithMeta(questionMeta, aa.question_id, userAnswerRaw);
    const aiAnswer = skipAiGrading ? null : (aiAnswerMap.get(aa.question_id) ?? null);
    await supabase
      .from("attempt_answers")
      .update({ ai_answer: aiAnswer, is_correct: isCorrect })
      .eq("id", aa.id);
  }

  if (insertMissingAnswers) {
    const answeredIds = new Set((attemptAnswers ?? []).map((a) => a.question_id));
    for (const q of questions) {
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
  }

  const { data: answersWithAi } = await supabase
    .from("attempt_answers")
    .select("question_id, user_answer, ai_answer, is_correct")
    .eq("attempt_id", attemptId);

  const scopedAnswers = (answersWithAi ?? []).filter((a) => questionIdSet.has(a.question_id));
  const answerByQ = new Map(scopedAnswers.map((a) => [a.question_id, a]));

  const counts = computeGradeCounts(
    questionIdSet,
    questionMeta,
    scopedAnswers,
    skipAiGrading,
    skipAiGrading ? questions.length : questions.length
  );

  const breakdown = buildBreakdown(questions, answerByQ);

  return { breakdown, counts };
}
