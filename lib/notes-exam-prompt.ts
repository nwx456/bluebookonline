import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { SUBJECT_META } from "@/lib/subject-meta";

export type NotesDifficultyPreset = "easy" | "medium" | "hard";

export interface NotesExamPromptParams {
  subject: SubjectKey;
  questionCount: number;
  difficulty: NotesDifficultyPreset;
  topicTitle?: string | null;
  truncationNotice?: string | null;
}

const DIFFICULTY_DISTRIBUTION: Record<
  NotesDifficultyPreset,
  { easy: number; medium: number; hard: number }
> = {
  easy: { easy: 50, medium: 40, hard: 10 },
  medium: { easy: 20, medium: 50, hard: 30 },
  hard: { easy: 10, medium: 40, hard: 50 },
};

const OUTPUT_JSON_SCHEMA = `{
  "topic_title": "string — unit/topic title for this exam",
  "subtopic_allocation": [
    { "subtopic": "string", "question_numbers": [1, 2] }
  ],
  "truncation_notice": "string or null — echo server truncation notice if provided",
  "questions": [
    {
      "question_number": 1,
      "question_text": "string — question stem only",
      "passage_text": "string or null — data tables in pipe format, scenarios as plain text",
      "options": ["A text", "B text", "C text", "D text"],
      "correct_answer": "A",
      "difficulty": "easy | medium | hard",
      "question_category": "conceptual | interpretation | calculation | synthesis",
      "explanation": "string — why the correct choice is right; for calculations show steps"
    }
  ]
}`;

function isNumericalSubject(subject: SubjectKey): boolean {
  const category = SUBJECT_META[subject]?.category;
  return category === "math" || category === "science" || category === "economics" || category === "cs";
}

export function getDifficultyDistribution(difficulty: NotesDifficultyPreset): {
  easy: number;
  medium: number;
  hard: number;
} {
  return DIFFICULTY_DISTRIBUTION[difficulty];
}

export function buildNotesExamPrompt(params: NotesExamPromptParams): string {
  const subjectName = SUBJECT_LABELS[params.subject] ?? params.subject;
  const dist = getDifficultyDistribution(params.difficulty);
  const topicInstruction = params.topicTitle?.trim()
    ? `Use this unit/topic title exactly: "${params.topicTitle.trim()}".`
    : "Derive a concise unit/topic title from the notes and return it as topic_title.";
  const truncationBlock = params.truncationNotice?.trim()
    ? `\nIMPORTANT: The notes were truncated server-side. Echo this in truncation_notice: "${params.truncationNotice.trim()}"\n`
    : "";
  const calculatorSection = isNumericalSubject(params.subject)
    ? `## 4. CALCULATOR / TECHNICAL REQUIREMENTS
- A portion of the questions should require calculator use or computation.
- Pull formulas from the notes when present; otherwise use standard AP formula sheet versions.
- Choose numbers that do not produce overly clean round results — students should actually compute, while keeping results reasonable.`
    : `## 4. CALCULATOR / TECHNICAL REQUIREMENTS
- This subject is primarily conceptual; prioritize conceptual and interpretation questions.
- If a small number of numerical items fit the notes, include them, but do not force heavy calculation.`;

  return `You are an experienced ${subjectName} teacher and an expert question writer fluent in the official College Board AP exam format. Your task is to use the notes provided as your source material and build a real AP-exam-quality practice test of ${params.questionCount} questions.
${truncationBlock}
${topicInstruction}

## 1. SOURCE USAGE
- Scan EVERY sub-topic, definition, formula, rule, and example that appears in the notes.
- For concepts the notes mention but do not fully spell out, fill gaps using standard ${subjectName} AP curriculum knowledge — but prioritize the terminology and emphasis from the notes.
- If the notes flag anything as "caution," "critical rule," "common exam trap," or "frequent mistake," include at least one question testing exactly that.
- If the notes contain example questions, do NOT copy them verbatim — only borrow STYLE, difficulty, and underlying logic; change numbers and scenarios so they are original.
- Notes may be in any language; write all exam questions in English unless the notes are clearly for a non-English AP course.

## 2. COVERAGE AND DISTRIBUTION
- The ${params.questionCount} questions must be distributed proportionally across ALL sub-topics in the notes — no sub-topic skipped, none overweighted.
- In subtopic_allocation, list sub-topics from the notes and assign question_numbers to each BEFORE writing questions.
- Mix question types approximately:
  * Conceptual / definition-recognition (~25%)
  * Interpretation (graphs, tables, scenarios) (~25%) — when a question uses tabular data, format the table in passage_text as a GitHub-style pipe table (see Section 5)
  * Calculation (~35% for numerical subjects; otherwise shift to conceptual/interpretation)
  * Multi-step / synthesis (~15%)
- If the notes contain too little material for ${params.questionCount} questions, still produce ${params.questionCount} by expanding with standard AP-level content on the same sub-topics.

## 3. DIFFICULTY AND STYLE
- Match REAL AP exam difficulty: thought-provoking, some "gotcha" questions targeting common misconceptions with tempting wrong answers — never absurd or unsolvable.
- Every question must have exactly 4 answer choices (A–D), matching the current College Board AP MCQ format.
- Distractors must represent common student mistakes or partially correct processes.
- Target difficulty spread: ~${dist.easy}% easy, ~${dist.medium}% medium, ~${dist.hard}% hard (label each question difficulty accordingly).
- Avoid shallow rote memorization; test genuine understanding.

${calculatorSection}

## 5. FORMAT AND OUTPUT RULES
- Return ONLY valid JSON matching this schema (no markdown fences, no prose outside JSON):
${OUTPUT_JSON_SCHEMA}
- Write all math in plain text/Unicode (x², √, ≤, fractions as a/b). Do NOT use LaTeX syntax like \\frac or $...$.
- When a question uses tabular data (experiment results, supply/demand schedules, datasets), write the table in passage_text using GitHub-style pipe format:
  | Trial | Volume (mL) | Temperature (°C) |
  |---|---|---|
  | 1 | 5.0 | 22 |
  | 2 | 10.0 | 31 |
  Rules: header row + separator row + data rows; same column count on every row; keep cells short (numbers, units, 1–4 words). Use 2–6 columns and 2–8 data rows.
- A brief lead-in sentence (e.g. "The table shows the results of an experiment.") may precede the table in passage_text on its own line, separated by a blank line.
- Only include a table when the question genuinely needs one; never force a table on every question.
- Put non-tabular scenarios and datasets without clear columns in passage_text as plain prose (not pipe tables).
- Every question must have a non-empty explanation with reasoning; for calculations include formula → substitution → result.
- correct_answer must be exactly one of A, B, C, or D.
- options must contain exactly 4 non-empty strings.
- question_number must run from 1 through ${params.questionCount} with no gaps.

## 6. PRE-DELIVERY CHECKLIST (apply internally; do not include in output)
- Every sub-topic appears in at least one question.
- No question has more than one correct answer.
- No question is ambiguous or self-contradictory.
- Calculations are numerically accurate.
- Difficulty distribution roughly matches the target ratios.
- Nothing copied verbatim from the source notes.

Generate the ${params.questionCount}-question exam now.`;
}
