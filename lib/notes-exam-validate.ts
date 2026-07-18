import type { NotesDifficultyPreset } from "@/lib/notes-exam-prompt";
import { getDifficultyDistribution } from "@/lib/notes-exam-prompt";

export type NotesQuestionCategory =
  | "conceptual"
  | "interpretation"
  | "calculation"
  | "synthesis";

export interface NotesGeneratedQuestion {
  question_number: number;
  question_text: string;
  passage_text: string | null;
  options: [string, string, string, string];
  correct_answer: "A" | "B" | "C" | "D";
  difficulty: "easy" | "medium" | "hard";
  question_category: NotesQuestionCategory;
  explanation: string;
}

export interface NotesGeneratedExam {
  topic_title: string;
  subtopic_allocation: Array<{ subtopic: string; question_numbers: number[] }>;
  truncation_notice: string | null;
  questions: NotesGeneratedQuestion[];
}

export type NotesValidationResult =
  | {
      ok: true;
      exam: NotesGeneratedExam;
      warnings: string[];
    }
  | {
      ok: false;
      errorCode: string;
      message: string;
      rawTextLen?: number;
    };

const VALID_ANSWERS = new Set(["A", "B", "C", "D"]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const VALID_CATEGORIES = new Set([
  "conceptual",
  "interpretation",
  "calculation",
  "synthesis",
]);

export const MIN_PARTIAL_ACCEPT_QUESTIONS = 15;

function parseJsonObject(raw: string): unknown | null {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeQuestion(raw: unknown, index: number): NotesGeneratedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const questionNumber = Number(q.question_number ?? index + 1);
  const questionText = asString(q.question_text ?? q.content ?? q.question);
  const optionsRaw = Array.isArray(q.options) ? q.options : [];
  const options = optionsRaw.slice(0, 4).map((o) => String(o ?? "").trim());
  if (options.length !== 4 || options.some((o) => !o)) return null;
  const correctRaw = String(q.correct_answer ?? q.correct ?? "").toUpperCase().trim();
  if (!VALID_ANSWERS.has(correctRaw)) return null;
  const difficulty = String(q.difficulty ?? "medium").toLowerCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) return null;
  const category = String(q.question_category ?? "conceptual").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) return null;
  const explanation = asString(q.explanation);
  if (!explanation) return null;
  const passageRaw = q.passage_text ?? q.image_description ?? null;
  const passageText =
    typeof passageRaw === "string" && passageRaw.trim() ? passageRaw.trim() : null;

  if (!questionText) return null;

  return {
    question_number: Number.isInteger(questionNumber) && questionNumber > 0 ? questionNumber : index + 1,
    question_text: questionText,
    passage_text: passageText,
    options: options as [string, string, string, string],
    correct_answer: correctRaw as "A" | "B" | "C" | "D",
    difficulty: difficulty as "easy" | "medium" | "hard",
    question_category: category as NotesQuestionCategory,
    explanation,
  };
}

function difficultyDistributionWarnings(
  questions: NotesGeneratedQuestion[],
  preset: NotesDifficultyPreset
): string[] {
  const target = getDifficultyDistribution(preset);
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const q of questions) counts[q.difficulty]++;
  const total = questions.length || 1;
  const warnings: string[] = [];
  for (const level of ["easy", "medium", "hard"] as const) {
    const actualPct = Math.round((counts[level] / total) * 100);
    const targetPct = target[level];
    if (Math.abs(actualPct - targetPct) > 20) {
      warnings.push(
        `Difficulty distribution drift: ${level} is ${actualPct}% (target ~${targetPct}%).`
      );
    }
  }
  return warnings;
}

export function validateNotesExamResponse(opts: {
  raw: string;
  requestedCount: number;
  difficulty: NotesDifficultyPreset;
}): NotesValidationResult {
  const parsed = parseJsonObject(opts.raw);
  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      errorCode: "PARSE_FAILED",
      message: "AI response could not be parsed as JSON.",
      rawTextLen: opts.raw.length,
    };
  }

  const root = parsed as Record<string, unknown>;
  const topicTitle = asString(root.topic_title) ?? "Generated Practice Exam";
  const questionsRaw = Array.isArray(root.questions) ? root.questions : [];
  if (questionsRaw.length === 0) {
    return {
      ok: false,
      errorCode: "MODEL_EMPTY_ARRAY",
      message: "AI returned no questions.",
      rawTextLen: opts.raw.length,
    };
  }

  const questions: NotesGeneratedQuestion[] = [];
  for (let i = 0; i < questionsRaw.length; i++) {
    const normalized = normalizeQuestion(questionsRaw[i], i);
    if (normalized) questions.push(normalized);
  }

  if (questions.length < MIN_PARTIAL_ACCEPT_QUESTIONS) {
    return {
      ok: false,
      errorCode: "INSUFFICIENT_QUESTIONS",
      message: `Only ${questions.length} valid questions were produced (minimum ${MIN_PARTIAL_ACCEPT_QUESTIONS}).`,
      rawTextLen: opts.raw.length,
    };
  }

  const warnings: string[] = [];
  if (questions.length < opts.requestedCount) {
    warnings.push(
      `Requested ${opts.requestedCount} questions but received ${questions.length}; saving partial exam.`
    );
  }

  questions.sort((a, b) => a.question_number - b.question_number);
  for (let i = 0; i < questions.length; i++) {
    questions[i].question_number = i + 1;
  }

  warnings.push(...difficultyDistributionWarnings(questions, opts.difficulty));

  const allocationRaw = Array.isArray(root.subtopic_allocation) ? root.subtopic_allocation : [];
  const subtopic_allocation = allocationRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const subtopic = asString(row.subtopic);
      const nums = Array.isArray(row.question_numbers)
        ? row.question_numbers.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
        : [];
      if (!subtopic) return null;
      return { subtopic, question_numbers: nums };
    })
    .filter((x): x is { subtopic: string; question_numbers: number[] } => x != null);

  const truncationNotice =
    typeof root.truncation_notice === "string" && root.truncation_notice.trim()
      ? root.truncation_notice.trim()
      : null;

  return {
    ok: true,
    exam: {
      topic_title: topicTitle,
      subtopic_allocation,
      truncation_notice: truncationNotice,
      questions: questions.slice(0, opts.requestedCount),
    },
    warnings,
  };
}

export function notesExamToQuestionRows(
  uploadId: string,
  exam: NotesGeneratedExam
): Array<Record<string, unknown>> {
  return exam.questions.map((q, index) => ({
    upload_id: uploadId,
    question_number: index + 1,
    question_text: q.question_text,
    passage_text: q.passage_text,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    option_e: null,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    question_type: "mcq",
    sat_difficulty: q.difficulty,
    has_graph: false,
    image_url: null,
  }));
}
