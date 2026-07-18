import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/lib/gemini-client";
import { getFrqCourse, type FrqCourseId } from "@/lib/frq-courses";
import {
  buildFrqGuidelineGenerationUserPrompt,
  getFrqGuidelineGenerationSystemPrompt,
  parseFrqGuidelineGenerationResponse,
} from "@/lib/frq-prompts";
import {
  getRubricForQuestionType,
  rubricTemplateToPromptText,
} from "@/lib/frq-rubrics";
import { normalizeFrqParts, type FrqQuestionRow } from "@/lib/frq-server";

export type ScoringGuidelineRow = {
  criterion: string;
  points: number;
  description: string;
};

export type ScoringGuidelines = {
  rows: ScoringGuidelineRow[];
  generated?: boolean;
};

export function hasValidScoringGuidelines(
  guidelines: Record<string, unknown> | null | undefined
): boolean {
  if (!guidelines || typeof guidelines !== "object") return false;
  const rows = (guidelines as ScoringGuidelines).rows;
  return Array.isArray(rows) && rows.length > 0;
}

function buildFallbackGuidelines(
  question: FrqQuestionRow,
  courseId: FrqCourseId
): ScoringGuidelines {
  const course = getFrqCourse(courseId);
  const template = getRubricForQuestionType(
    courseId,
    question.question_type,
    course?.rubricTemplateId ?? "generic_points"
  );
  const parts = normalizeFrqParts(question.parts);
  const totalPoints = question.max_points || parts.reduce((s, p) => s + (p.max_points ?? 0), 0);

  if (parts.length > 1) {
    const perPart = Math.max(1, Math.floor(totalPoints / parts.length));
    return {
      generated: true,
      rows: parts.map((part, i) => ({
        criterion: part.label
          ? `Part (${part.label})`
          : `Part ${i + 1}`,
        points: part.max_points ?? perPart,
        description: `Accurately addresses part (${part.label || i + 1}) requirements.`,
      })),
    };
  }

  return {
    generated: true,
    rows: template.rows.map((row) => ({
      criterion: row.criterion,
      points: row.maxPoints,
      description: row.description,
    })),
  };
}

export async function ensureScoringGuidelines(
  supabase: SupabaseClient,
  question: FrqQuestionRow,
  courseId: FrqCourseId
): Promise<Record<string, unknown>> {
  if (hasValidScoringGuidelines(question.scoring_guidelines)) {
    return question.scoring_guidelines!;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const course = getFrqCourse(courseId);
  const template = getRubricForQuestionType(
    courseId,
    question.question_type,
    course?.rubricTemplateId ?? "generic_points"
  );
  const parts = normalizeFrqParts(question.parts);

  let generated: ScoringGuidelines = buildFallbackGuidelines(question, courseId);

  if (apiKey?.trim()) {
    try {
      const { text } = await generateWithFallback({
        apiKey,
        systemInstruction: getFrqGuidelineGenerationSystemPrompt(courseId),
        contents: buildFrqGuidelineGenerationUserPrompt({
          courseId,
          questionNumber: question.question_number,
          questionType: question.question_type,
          promptHtml: question.prompt_html,
          stimulusHtml: question.stimulus_html,
          parts,
          maxPoints: question.max_points,
          rubricTemplate: rubricTemplateToPromptText(template),
        }),
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const parsed = parseFrqGuidelineGenerationResponse(text);
      if (parsed?.rows?.length) {
        generated = { rows: parsed.rows, generated: true };
      }
    } catch (err) {
      console.error("ensureScoringGuidelines AI error:", err);
    }
  }

  const payload = generated as unknown as Record<string, unknown>;

  await supabase
    .from("frq_questions")
    .update({ scoring_guidelines: payload })
    .eq("id", question.id);

  return payload;
}
