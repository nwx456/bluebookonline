import type { FrqCourseId } from "./frq-courses";
import { getFrqCourse } from "./frq-courses";

export interface FrqExtractedPart {
  label: string;
  prompt: string;
  max_points?: number;
}

export interface FrqExtractedQuestion {
  question_number: number;
  question_type: string;
  prompt_html: string;
  stimulus_html?: string | null;
  parts: FrqExtractedPart[];
  max_points: number;
  scoring_guidelines?: Record<string, unknown> | null;
  page_refs?: number[] | null;
}

export function getFrqExtractionSystemPrompt(courseId: FrqCourseId): string {
  const course = getFrqCourse(courseId);
  const courseName = course?.fullName ?? courseId;
  const editorHint =
    course?.editorType === "code"
      ? "This is a Java coding FRQ exam. Extract method/class headers and part labels (a, b, c) exactly as shown."
      : "This is a written FRQ exam. Preserve passages, documents, and source material in stimulus_html.";

  return `You are an expert AP exam document parser for College Board Free Response Questions (FRQ).

Course: ${courseName}
${editorHint}

Extract ONLY the Free Response section (Section II). Do NOT extract multiple-choice questions.

Return a JSON array of question objects with this exact schema:
[
  {
    "question_number": 1,
    "question_type": "essay|saq|dbq|leq|code|generic|aaq|ebq",
    "prompt_html": "<p>HTML of shared question intro and instructions (left panel only). Do NOT include part-specific instructions.</p>",
    "stimulus_html": "<p>HTML of passages, documents, source material, or code context shown on the left panel. null if none.</p>",
    "parts": [
      { "label": "a", "prompt": "<p>Part (a) instructions with HTML, e.g. <code>methodName</code></p>", "max_points": 3 }
    ],
    "max_points": 6,
    "scoring_guidelines": { "rows": [{ "criterion": "...", "points": 1 }] },
    "page_refs": [1, 2]
  }
]

Rules:
- question_number starts at 1 and increments sequentially.
- For multi-part questions, include each part in "parts" with label (a, b, c or A, B, C for coding FRQs).
- prompt_html = shared question intro and general instructions only (left panel). Example: question number line ("1. This question involves…"), course-wide directions. Do NOT put part-specific instructions (a, b, c or A, B, C) in prompt_html.
- stimulus_html = read-only context for the left panel: passages, documents, graphs, tables, and full code class definitions (e.g. public class DogWalkCompany { … }). null if none.
- parts[].prompt = HTML instructions for that part only (right panel). Use <code> for identifiers/method names. Each part prompt should start with its label (e.g. "Part (a)" or "A.").
- For single-part questions, put the full question stem in parts[0].prompt (or prompt_html if no parts array); stimulus_html holds any separate context.
- Use simple HTML tags: p, strong, em, ul, ol, li, br, h3, h4, blockquote, table, tr, td, th, code, pre.
- Put data tables in stimulus_html using proper <table> HTML (not plain-text pipes). Students see tables on the left panel.
- When a question includes a graph, chart, figure, or map that cannot be reproduced as HTML, set page_refs to the 1-based PDF page number(s) where that visual appears.
- If scoring guidelines/rubric appear in the document, extract them into scoring_guidelines.
- If point values are shown, use them; otherwise estimate from standard AP format for this course.
- Return ONLY valid JSON array, no markdown fences.`;
}

export function getFrqGradingSystemPrompt(courseId: FrqCourseId): string {
  const course = getFrqCourse(courseId);
  const courseName = course?.fullName ?? courseId;

  return `You are an official AP exam scorer grading a ${courseName} Free Response Question.

Grade the student's response using College Board scoring guidelines and rubrics.
Apply partial credit where appropriate. Be fair but rigorous.

For Java code (AP CSA): Apply official penalty rules:
- Missing curly brackets: clear indentation can convey intent outside left-justified code.
- Assume missing closing quotes/parentheses at end of line before semicolon.
- Minor syntax errors may be forgiven if intent is clear.

Return ONLY valid JSON:
{
  "score": 4,
  "max_score": 6,
  "rubric_breakdown": [
    {
      "criterion": "Thesis/Claim",
      "max_points": 1,
      "earned_points": 1,
      "earned": true,
      "justification": "Student presents a defensible thesis..."
    }
  ],
  "feedback": "Overall feedback paragraph with specific improvement suggestions.",
  "strengths": ["..."],
  "improvements": ["..."]
}`;
}

export function buildFrqGradingUserPrompt(opts: {
  courseId: FrqCourseId;
  questionNumber: number;
  questionType: string;
  promptHtml: string;
  stimulusHtml?: string | null;
  partLabel: string;
  partPrompt?: string;
  maxPoints: number;
  responseText: string;
  scoringGuidelines?: Record<string, unknown> | null;
  rubricTemplate?: string;
}): string {
  const parts: string[] = [
    `Question ${opts.questionNumber} (${opts.questionType})`,
    `Part: ${opts.partLabel || "(single response)"}`,
    `Max points: ${opts.maxPoints}`,
    "",
    "=== QUESTION PROMPT ===",
    opts.promptHtml,
  ];

  if (opts.stimulusHtml?.trim()) {
    parts.push("", "=== STIMULUS / PASSAGE ===", opts.stimulusHtml);
  }
  if (opts.partPrompt?.trim()) {
    parts.push("", "=== PART INSTRUCTIONS ===", opts.partPrompt);
  }
  if (opts.scoringGuidelines) {
    parts.push("", "=== SCORING GUIDELINES FROM DOCUMENT ===", JSON.stringify(opts.scoringGuidelines, null, 2));
  }
  if (opts.rubricTemplate) {
    parts.push("", "=== STANDARD RUBRIC TEMPLATE ===", opts.rubricTemplate);
  }
  parts.push("", "=== STUDENT RESPONSE ===", opts.responseText || "(empty response)");

  return parts.join("\n");
}

export function getFrqGuidelineGenerationSystemPrompt(courseId: FrqCourseId): string {
  const course = getFrqCourse(courseId);
  const courseName = course?.fullName ?? courseId;

  return `You are an expert AP exam rubric writer for ${courseName} Free Response Questions.

Create scoring guidelines tailored to ONE specific FRQ question. Each question must have its own rubric — do NOT reuse a generic template verbatim.

Return ONLY valid JSON:
{
  "rows": [
    {
      "criterion": "Thesis/Claim",
      "points": 1,
      "description": "What earns this point for this specific question."
    }
  ]
}

Rules:
- Row point values must sum to the question's max points (or the part's max points when grading a single part).
- Use criteria appropriate for the course and question type (essay, saq, dbq, leq, code, etc.).
- Descriptions must reference this question's actual prompts and parts.
- Return ONLY JSON, no markdown fences.`;
}

export function buildFrqGuidelineGenerationUserPrompt(opts: {
  courseId: FrqCourseId;
  questionNumber: number;
  questionType: string;
  promptHtml: string;
  stimulusHtml?: string | null;
  parts: Array<{ label: string; prompt?: string; max_points?: number }>;
  maxPoints: number;
  rubricTemplate?: string;
}): string {
  const parts: string[] = [
    `Question ${opts.questionNumber} (${opts.questionType})`,
    `Total max points: ${opts.maxPoints}`,
    "",
    "=== QUESTION PROMPT ===",
    opts.promptHtml,
  ];

  if (opts.stimulusHtml?.trim()) {
    parts.push("", "=== STIMULUS / PASSAGE ===", opts.stimulusHtml);
  }

  parts.push("", "=== PARTS ===");
  for (const part of opts.parts) {
    parts.push(
      `- Part (${part.label || "single"}): max ${part.max_points ?? "?"} pts`,
      part.prompt ?? "(no part prompt)"
    );
  }

  if (opts.rubricTemplate) {
    parts.push(
      "",
      "=== REFERENCE RUBRIC (adapt to this question; do not copy verbatim) ===",
      opts.rubricTemplate
    );
  }

  return parts.join("\n");
}

export function parseFrqGuidelineGenerationResponse(raw: string): {
  rows: Array<{ criterion: string; points: number; description: string }>;
} | null {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();

  const tryParse = (input: string) => {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    if (!Array.isArray(parsed.rows)) return null;
    const rows = (parsed.rows as Array<Record<string, unknown>>)
      .map((row) => ({
        criterion: String(row.criterion ?? "").trim(),
        points: typeof row.points === "number" ? row.points : Number(row.points) || 0,
        description: String(row.description ?? "").trim(),
      }))
      .filter((row) => row.criterion && row.points > 0);
    return rows.length > 0 ? { rows } : null;
  };

  try {
    return tryParse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return tryParse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseGradingPayload(parsed: Record<string, unknown>) {
  if (typeof parsed.score !== "number") return null;
  return {
    score: parsed.score,
    max_score: typeof parsed.max_score === "number" ? parsed.max_score : 0,
    rubric_breakdown: Array.isArray(parsed.rubric_breakdown)
      ? (parsed.rubric_breakdown as Array<{
          criterion: string;
          max_points: number;
          earned_points: number;
          earned: boolean;
          justification: string;
        }>)
      : [],
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    strengths: parseStringArray(parsed.strengths),
    improvements: parseStringArray(parsed.improvements),
  };
}

export function parseFrqExtractionResponse(raw: string): FrqExtractedQuestion[] {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed as FrqExtractedQuestion[];
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
        if (Array.isArray(parsed)) return parsed as FrqExtractedQuestion[];
      } catch {
        // fall through
      }
    }
  }
  return [];
}

export function parseFrqGradingResponse(raw: string): {
  score: number;
  max_score: number;
  rubric_breakdown: Array<{
    criterion: string;
    max_points: number;
    earned_points: number;
    earned: boolean;
    justification: string;
  }>;
  feedback: string;
  strengths: string[];
  improvements: string[];
} | null {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parseGradingPayload(parsed);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        return parseGradingPayload(parsed);
      } catch {
        return null;
      }
    }
    return null;
  }
}
