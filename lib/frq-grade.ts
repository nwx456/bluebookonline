import { generateWithFallback } from "@/lib/gemini-client";
import {
  buildFrqGradingUserPrompt,
  getFrqGradingSystemPrompt,
  parseFrqGradingResponse,
} from "@/lib/frq-prompts";
import { getFrqCourse, type FrqCourseId } from "@/lib/frq-courses";
import {
  getRubricForQuestionType,
  rubricTemplateToPromptText,
} from "@/lib/frq-rubrics";
import { getPartMaxPoints, type FrqQuestionRow } from "@/lib/frq-server";

export interface GradeFrqResponseInput {
  courseId: FrqCourseId;
  question: FrqQuestionRow;
  partLabel: string;
  partPrompt?: string;
  responseText: string;
}

export interface GradeFrqResponseResult {
  score: number;
  maxScore: number;
  rubricBreakdown: Array<{
    criterion: string;
    max_points: number;
    earned_points: number;
    earned: boolean;
    justification: string;
  }>;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export async function gradeFrqResponse(
  input: GradeFrqResponseInput
): Promise<GradeFrqResponseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const course = getFrqCourse(input.courseId);
  const rubric = getRubricForQuestionType(
    input.courseId,
    input.question.question_type,
    course?.rubricTemplateId ?? "generic_points"
  );

  const part = input.question.parts.find((p) => p.label === input.partLabel);
  const maxPoints = getPartMaxPoints(input.question, input.partLabel);

  const userPrompt = buildFrqGradingUserPrompt({
    courseId: input.courseId,
    questionNumber: input.question.question_number,
    questionType: input.question.question_type,
    promptHtml: input.question.prompt_html,
    stimulusHtml: input.question.stimulus_html,
    partLabel: input.partLabel,
    partPrompt: input.partPrompt ?? part?.prompt,
    maxPoints,
    responseText: input.responseText,
    scoringGuidelines: input.question.scoring_guidelines,
    rubricTemplate: rubricTemplateToPromptText(rubric),
  });

  const { text } = await generateWithFallback({
    apiKey,
    systemInstruction: getFrqGradingSystemPrompt(input.courseId),
    contents: userPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const parsed = parseFrqGradingResponse(text);
  if (!parsed) {
    return {
      score: 0,
      maxScore: maxPoints,
      rubricBreakdown: [],
      feedback: "Could not parse grading response. Please try again.",
      strengths: [],
      improvements: [],
    };
  }

  return {
    score: Math.min(parsed.score, maxPoints),
    maxScore: parsed.max_score || maxPoints,
    rubricBreakdown: parsed.rubric_breakdown,
    feedback: parsed.feedback,
    strengths: parsed.strengths,
    improvements: parsed.improvements,
  };
}
