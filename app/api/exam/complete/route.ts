import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  gradeAndPersistQuestionSubset,
  type GradeQuestionRow,
} from "@/lib/exam-grade";
import type { SubjectKey } from "@/lib/gemini-prompts";
import { getExamProgram, isSatFullTest } from "@/lib/exam-program";

/** Scale raw correct count -> SAT R&W scaled score (200-800). */
function scaleRwScore(correct: number, totalAvailable: number, hadHardM2: boolean): number {
  if (totalAvailable <= 0) return 200;
  const ratio = Math.max(0, Math.min(1, correct / totalAvailable));
  let score = Math.round(200 + ratio * 600);
  if (hadHardM2) score = Math.min(800, score + 30);
  return Math.max(200, Math.min(800, score));
}

/** Scale raw correct count -> SAT Math scaled score (200-800). */
function scaleMathScore(correct: number, totalAvailable: number, hadHardM2: boolean): number {
  if (totalAvailable <= 0) return 200;
  const ratio = Math.max(0, Math.min(1, correct / totalAvailable));
  let score = Math.round(200 + ratio * 600);
  if (hadHardM2) score = Math.min(800, score + 30);
  return Math.max(200, Math.min(800, score));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const skipAiGrading = body.skipAiGrading === true || body.skip_ai_grading === true;
    const selectedRwM2VariantRaw = (body.selectedRwM2Variant ??
      body.selected_rw_m2_variant) as string | undefined;
    const selectedMathM2VariantRaw = (body.selectedMathM2Variant ??
      body.selected_math_m2_variant) as string | undefined;
    const selectedRwM2Variant =
      selectedRwM2VariantRaw === "easy" || selectedRwM2VariantRaw === "hard"
        ? selectedRwM2VariantRaw
        : null;
    const selectedMathM2Variant =
      selectedMathM2VariantRaw === "easy" || selectedMathM2VariantRaw === "hard"
        ? selectedMathM2VariantRaw
        : null;

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
      .select("subject, storage_path, exam_program, sat_format, sat_adaptive_mode")
      .eq("id", attempt.upload_id)
      .single();

    const subject = (upload?.subject ?? "AP_PSYCHOLOGY") as SubjectKey;
    const examProgram = (upload?.exam_program ?? getExamProgram(subject)) as "AP" | "SAT";
    const isSat = examProgram === "SAT";
    const isSatFull = isSatFullTest(subject);

    const { data: allQuestions } = await supabase
      .from("questions")
      .select(
        "id, question_number, question_text, passage_text, precondition_text, option_a, option_b, option_c, option_d, option_e, correct_answer, page_number, has_graph, bbox, question_type, accepted_answers, sat_section, sat_module, sat_module_variant, sat_difficulty"
      )
      .eq("upload_id", attempt.upload_id)
      .order("question_number", { ascending: true })
      .order("id", { ascending: true });

    if (!allQuestions?.length) {
      return NextResponse.json({ error: "No questions found." }, { status: 400 });
    }

    const questions = allQuestions as GradeQuestionRow[];

    const { breakdown, counts } = await gradeAndPersistQuestionSubset({
      supabase,
      attemptId,
      subject,
      storagePath: upload?.storage_path ?? null,
      uploadId: attempt.upload_id,
      questions,
      skipAiGrading,
      insertMissingAnswers: true,
    });

    const startedAt = attempt.started_at ? new Date(attempt.started_at) : new Date();
    const completedAt = new Date();
    const timeSpentSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
    );

    type SatModuleStats = {
      module: string;
      section: "rw" | "math";
      moduleNumber: 1 | 2;
      correct: number;
      total: number;
    };
    let rwScaled: number | null = null;
    let mathScaled: number | null = null;
    let totalScaled: number | null = null;
    const satModuleStats: SatModuleStats[] = [];

    if (isSat) {
      const { data: finalAnswers } = await supabase
        .from("attempt_answers")
        .select("question_id, user_answer, is_correct")
        .eq("attempt_id", attemptId);

      const finalAnswerMap = new Map(
        (finalAnswers ?? []).map((a) => [a.question_id, a] as const)
      );
      const groups = new Map<string, SatModuleStats>();
      const satAdaptiveMode = (upload as { sat_adaptive_mode?: string | null })?.sat_adaptive_mode;
      const useSixModule = satAdaptiveMode === "six_module";
      let rwHardM2 = useSixModule ? selectedRwM2Variant === "hard" : false;
      let mathHardM2 = useSixModule ? selectedMathM2Variant === "hard" : false;

      for (const q of questions) {
        const section = (q.sat_section === "math" ? "math" : "rw") as "rw" | "math";
        const moduleNumber = (q.sat_module === 2 ? 2 : 1) as 1 | 2;
        const variant = q.sat_module_variant;

        if (useSixModule && moduleNumber === 2) {
          const selectedVariant = section === "rw" ? selectedRwM2Variant : selectedMathM2Variant;
          if (variant && selectedVariant && variant !== selectedVariant) continue;
        } else if (!useSixModule && moduleNumber === 2 && variant === "hard") {
          if (section === "rw") rwHardM2 = true;
          if (section === "math") mathHardM2 = true;
        }

        const key = `${section}${moduleNumber}`;
        let stats = groups.get(key);
        if (!stats) {
          stats = { module: key, section, moduleNumber, correct: 0, total: 0 };
          groups.set(key, stats);
        }
        stats.total++;
        const a = finalAnswerMap.get(q.id);
        if (a?.is_correct) stats.correct++;
      }

      const rwStats = ["rw1", "rw2"]
        .map((k) => groups.get(k))
        .filter((g): g is SatModuleStats => !!g);
      const mathStats = ["math1", "math2"]
        .map((k) => groups.get(k))
        .filter((g): g is SatModuleStats => !!g);

      const rwTotalCorrect = rwStats.reduce((s, g) => s + g.correct, 0);
      const rwTotalAvail = rwStats.reduce((s, g) => s + g.total, 0);
      const mathTotalCorrect = mathStats.reduce((s, g) => s + g.correct, 0);
      const mathTotalAvail = mathStats.reduce((s, g) => s + g.total, 0);

      if (rwTotalAvail > 0) rwScaled = scaleRwScore(rwTotalCorrect, rwTotalAvail, rwHardM2);
      if (mathTotalAvail > 0) mathScaled = scaleMathScore(mathTotalCorrect, mathTotalAvail, mathHardM2);
      if (rwScaled != null || mathScaled != null) {
        totalScaled = (rwScaled ?? 0) + (mathScaled ?? 0);
      }

      const order: Array<"rw1" | "rw2" | "math1" | "math2"> = ["rw1", "rw2", "math1", "math2"];
      for (const key of order) {
        const g = groups.get(key);
        if (g) satModuleStats.push(g);
      }
    }

    const attemptUpdateBase: Record<string, unknown> = {
      completed_at: completedAt.toISOString(),
      time_spent_seconds: timeSpentSeconds,
      correct_count: counts.correctCount,
      incorrect_count: counts.incorrectCount,
      unanswered_count: counts.unansweredCount,
    };

    if (isSat) {
      const moduleProgress: Record<string, { correct: number; total: number }> = {};
      for (const m of satModuleStats) {
        moduleProgress[m.module] = { correct: m.correct, total: m.total };
      }
      attemptUpdateBase.module_progress = moduleProgress;
      if (rwScaled != null) attemptUpdateBase.rw_scaled_score = rwScaled;
      if (mathScaled != null) attemptUpdateBase.math_scaled_score = mathScaled;
      if (totalScaled != null) attemptUpdateBase.total_scaled_score = totalScaled;
    }

    const { error: attemptUpdateError } = await supabase
      .from("attempts")
      .update({ ...attemptUpdateBase, skip_ai_grading: skipAiGrading })
      .eq("id", attemptId);

    if (attemptUpdateError) {
      await supabase.from("attempts").update(attemptUpdateBase).eq("id", attemptId);
    }

    return NextResponse.json({
      ok: true,
      total: questions.length,
      correctCount: counts.correctCount,
      incorrectCount: counts.incorrectCount,
      unansweredCount: counts.unansweredCount,
      notGradedCount: counts.notGradedCount,
      skipAiGrading,
      percentage: counts.percentage,
      timeSpentSeconds,
      breakdown,
      examProgram,
      sat: isSat
        ? {
            isFullTest: isSatFull,
            rwScaled,
            mathScaled,
            totalScaled,
            modules: satModuleStats,
          }
        : null,
    });
  } catch (err) {
    console.error("exam complete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete exam." },
      { status: 500 }
    );
  }
}
