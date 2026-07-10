import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  filterQuestionsForSatModule,
  gradeAndPersistQuestionSubset,
  type GradeQuestionRow,
} from "@/lib/exam-grade";
import type { SubjectKey } from "@/lib/gemini-prompts";
import {
  getExamProgram,
  isSatFullTest,
  SAT_MODULES,
  satSectionForSubject,
  usesSatModuleFlow,
  type SatModuleId,
  type SatModuleVariant,
  type SatSection,
} from "@/lib/exam-program";

const HARD_M2_BONUS = 30;

/** Scale raw correct count -> SAT scaled score (200-800). */
function scaleSectionScore(
  correct: number,
  totalAvailable: number,
  useSixModule: boolean,
  hardM2: boolean
): number {
  if (totalAvailable <= 0) return 200;
  const ratio = Math.max(0, Math.min(1, correct / totalAvailable));
  let score = Math.round(200 + ratio * 600);
  if (useSixModule && hardM2) score = Math.min(800, score + HARD_M2_BONUS);
  return Math.max(200, Math.min(800, score));
}

function normalizeVariant(raw: string | undefined): SatModuleVariant | null {
  return raw === "easy" || raw === "hard" ? raw : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const skipAiGrading = body.skipAiGrading === true || body.skip_ai_grading === true;
    const selectedRwM2Variant = normalizeVariant(
      (body.selectedRwM2Variant ?? body.selected_rw_m2_variant) as string | undefined
    );
    const selectedMathM2Variant = normalizeVariant(
      (body.selectedMathM2Variant ?? body.selected_math_m2_variant) as
        | string
        | undefined
    );

    if (!attemptId?.trim()) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, upload_id, started_at, completed_at, module_progress")
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
    const satFormat = (upload as { sat_format?: string | null })?.sat_format ?? null;
    const usesModuleFlow = usesSatModuleFlow({ subject, satFormat });
    const satAdaptiveMode = (upload as { sat_adaptive_mode?: string | null })
      ?.sat_adaptive_mode;
    const useSixModule = satAdaptiveMode === "six_module";
    const sectionOnly = satSectionForSubject(subject);

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

    // ------------------------------------------------------------------
    // Build the set of questions to actually grade.
    //
    // - AP / single-module SAT: grade every question as-is.
    // - SAT full test / section test: STRICT filter — only questions with an
    //   explicit sat_section + sat_module are graded, and in six_module the
    //   M2 questions must match the user-selected easy/hard variant.
    // ------------------------------------------------------------------
    const questionsToGrade: GradeQuestionRow[] = usesModuleFlow
      ? (() => {
          const relevantModules = SAT_MODULES.filter(
            (m) => !sectionOnly || m.section === sectionOnly
          );
          const seen = new Set<string>();
          const out: GradeQuestionRow[] = [];
          for (const mod of relevantModules) {
            const modQuestions = filterQuestionsForSatModule(questions, mod.id, {
              isSatFull: true,
              satAdaptiveMode,
              selectedRwM2Variant,
              selectedMathM2Variant,
            });
            for (const q of modQuestions) {
              if (seen.has(q.id)) continue;
              seen.add(q.id);
              out.push(q);
            }
          }
          return out;
        })()
      : questions;

    const { breakdown, counts } = await gradeAndPersistQuestionSubset({
      supabase,
      attemptId,
      subject,
      storagePath: upload?.storage_path ?? null,
      uploadId: attempt.upload_id,
      questions: questionsToGrade,
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
      section: SatSection;
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

      // Compute stats per module using the SAME strict filter as grading.
      const modulesForStats: SatModuleId[] = usesModuleFlow
        ? SAT_MODULES.filter((m) => !sectionOnly || m.section === sectionOnly).map(
            (m) => m.id
          )
        : [];

      const rwHardM2 = useSixModule ? selectedRwM2Variant === "hard" : false;
      const mathHardM2 = useSixModule ? selectedMathM2Variant === "hard" : false;

      for (const modId of modulesForStats) {
        const target = SAT_MODULES.find((m) => m.id === modId)!;
        const modQuestions = filterQuestionsForSatModule(questions, modId, {
          isSatFull: true,
          satAdaptiveMode,
          selectedRwM2Variant,
          selectedMathM2Variant,
        });
        let correct = 0;
        for (const q of modQuestions) {
          const a = finalAnswerMap.get(q.id);
          if (a?.is_correct) correct++;
        }
        satModuleStats.push({
          module: modId,
          section: target.section,
          moduleNumber: target.module,
          correct,
          total: modQuestions.length,
        });
      }

      if (usesModuleFlow) {
        const rwStats = satModuleStats.filter((s) => s.section === "rw");
        const mathStats = satModuleStats.filter((s) => s.section === "math");
        const rwTotalCorrect = rwStats.reduce((s, g) => s + g.correct, 0);
        const rwTotalAvail = rwStats.reduce((s, g) => s + g.total, 0);
        const mathTotalCorrect = mathStats.reduce((s, g) => s + g.correct, 0);
        const mathTotalAvail = mathStats.reduce((s, g) => s + g.total, 0);

        if (rwTotalAvail > 0) {
          rwScaled = scaleSectionScore(
            rwTotalCorrect,
            rwTotalAvail,
            useSixModule,
            rwHardM2
          );
        }
        if (mathTotalAvail > 0) {
          mathScaled = scaleSectionScore(
            mathTotalCorrect,
            mathTotalAvail,
            useSixModule,
            mathHardM2
          );
        }

        if (isSatFull) {
          if (rwScaled != null || mathScaled != null) {
            totalScaled = (rwScaled ?? 0) + (mathScaled ?? 0);
          }
        } else if (sectionOnly) {
          totalScaled = sectionOnly === "rw" ? rwScaled : mathScaled;
        }
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
      // Guarantee module_progress has an entry for each expected module even
      // when the user skipped or emptied a module during the attempt.
      const existingProgress =
        attempt.module_progress && typeof attempt.module_progress === "object"
          ? (attempt.module_progress as Record<
              string,
              { correct: number; total: number }
            >)
          : {};
      const moduleProgress: Record<string, { correct: number; total: number }> = {
        ...existingProgress,
      };
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
      total: questionsToGrade.length,
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
            usesModuleFlow,
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
