import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  filterQuestionsForSatModule,
  gradeAndPersistQuestionSubset,
  type GradeQuestionRow,
} from "@/lib/exam-grade";
import type { SubjectKey } from "@/lib/gemini-prompts";
import {
  satSectionForSubject,
  SAT_MODULES,
  usesSatModuleFlow,
  type SatModuleId,
  type SatModuleVariant,
} from "@/lib/exam-program";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const moduleId = body.moduleId as SatModuleId | undefined;
    const skipAiGrading = body.skipAiGrading === true || body.skip_ai_grading === true;
    const selectedRwM2VariantRaw = (body.selectedRwM2Variant ??
      body.selected_rw_m2_variant) as string | undefined;
    const selectedMathM2VariantRaw = (body.selectedMathM2Variant ??
      body.selected_math_m2_variant) as string | undefined;
    const selectedRwM2Variant: SatModuleVariant | null =
      selectedRwM2VariantRaw === "easy" || selectedRwM2VariantRaw === "hard"
        ? selectedRwM2VariantRaw
        : null;
    const selectedMathM2Variant: SatModuleVariant | null =
      selectedMathM2VariantRaw === "easy" || selectedMathM2VariantRaw === "hard"
        ? selectedMathM2VariantRaw
        : null;

    if (!attemptId?.trim()) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }
    if (!moduleId || !SAT_MODULES.some((m) => m.id === moduleId)) {
      return NextResponse.json({ error: "Valid moduleId is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, upload_id, completed_at, module_progress")
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

    const subject = upload?.subject ?? "";
    if (!usesSatModuleFlow({ subject, satFormat: upload?.sat_format })) {
      return NextResponse.json(
        { error: "Module scoring is only available for multi-module SAT exams." },
        { status: 400 }
      );
    }

    const sectionOnly = satSectionForSubject(subject);
    if (sectionOnly) {
      const modDef = SAT_MODULES.find((m) => m.id === moduleId);
      if (!modDef || modDef.section !== sectionOnly) {
        return NextResponse.json(
          { error: "Module does not belong to this exam section." },
          { status: 400 }
        );
      }
    }

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

    const moduleQuestions = filterQuestionsForSatModule(allQuestions as GradeQuestionRow[], moduleId, {
      isSatFull: true,
      satAdaptiveMode: upload?.sat_adaptive_mode,
      selectedRwM2Variant,
      selectedMathM2Variant,
    });

    if (moduleQuestions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this module." },
        { status: 400 }
      );
    }

    const { breakdown, counts } = await gradeAndPersistQuestionSubset({
      supabase,
      attemptId,
      subject: subject as SubjectKey,
      storagePath: upload?.storage_path ?? null,
      uploadId: attempt.upload_id,
      questions: moduleQuestions,
      skipAiGrading,
      insertMissingAnswers: true,
    });

    const moduleDef = SAT_MODULES.find((m) => m.id === moduleId);
    const moduleKey = `${moduleDef?.section ?? "rw"}${moduleDef?.module ?? 1}`;

    const existingProgress =
      attempt.module_progress && typeof attempt.module_progress === "object"
        ? (attempt.module_progress as Record<string, { correct: number; total: number }>)
        : {};

    await supabase
      .from("attempts")
      .update({
        module_progress: {
          ...existingProgress,
          [moduleKey]: {
            correct: counts.correctCount,
            total: moduleQuestions.length,
          },
        },
      })
      .eq("id", attemptId);

    return NextResponse.json({
      ok: true,
      moduleId,
      moduleLabel: moduleDef?.label ?? moduleId,
      correctCount: counts.correctCount,
      incorrectCount: counts.incorrectCount,
      unansweredCount: counts.unansweredCount,
      notGradedCount: counts.notGradedCount,
      skipAiGrading,
      percentage: counts.percentage,
      breakdown,
      examProgram: "SAT" as const,
    });
  } catch (err) {
    console.error("exam score-module error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to score module." },
      { status: 500 }
    );
  }
}
