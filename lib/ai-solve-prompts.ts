/**
 * Ders bazlı AI solve prompt'ları.
 * correct_answer boş soruları çözmek için Gemini'ye gönderilecek.
 */

import { SUBJECT_LABELS, type SubjectKey } from "./gemini-prompts";

const SUBJECT_SOLVE_CONFIG: Record<SubjectKey, { passageLabel: string; reasoningHint: string }> = {
  AP_CSA: { passageLabel: "Reference code", reasoningHint: "Java knowledge" },
  AP_CSP: { passageLabel: "Reference code", reasoningHint: "computer science concepts" },
  AP_MICROECONOMICS: { passageLabel: "Graph/Table/Reference data", reasoningHint: "economic reasoning" },
  AP_MACROECONOMICS: { passageLabel: "Graph/Table/Reference data", reasoningHint: "economic reasoning" },
  AP_PSYCHOLOGY: { passageLabel: "Passage", reasoningHint: "psychology concepts" },
  AP_STATISTICS: { passageLabel: "Data/Table/Reference", reasoningHint: "statistical reasoning" },
  AP_BIOLOGY: { passageLabel: "Graph/Table/Reference data", reasoningHint: "biological reasoning" },
  AP_CHEMISTRY: { passageLabel: "Graph/Table/Reference data", reasoningHint: "chemical reasoning" },
  AP_PHYSICS_1: { passageLabel: "Graph/Table/Reference data", reasoningHint: "physics reasoning" },
  AP_PHYSICS_2: { passageLabel: "Graph/Table/Reference data", reasoningHint: "physics reasoning" },
  AP_PHYSICS_C_MECH: { passageLabel: "Graph/Table/Reference data", reasoningHint: "mechanics reasoning" },
  AP_PHYSICS_C_EM: { passageLabel: "Graph/Table/Reference data", reasoningHint: "electromagnetism reasoning" },
  AP_ENVIRONMENTAL_SCIENCE: { passageLabel: "Graph/Table/Reference data", reasoningHint: "environmental science reasoning" },
  AP_HUMAN_GEOGRAPHY: { passageLabel: "Graph/Table/Reference data", reasoningHint: "geographic reasoning" },
  AP_ENGLISH_LANG: { passageLabel: "Passage", reasoningHint: "rhetorical and language analysis" },
  AP_ENGLISH_LIT: { passageLabel: "Passage", reasoningHint: "literary analysis" },
  AP_US_HISTORY: { passageLabel: "Passage", reasoningHint: "historical reasoning" },
  AP_WORLD_HISTORY: { passageLabel: "Passage", reasoningHint: "historical reasoning" },
  AP_EUROPEAN_HISTORY: { passageLabel: "Passage", reasoningHint: "historical reasoning" },
  AP_US_GOVERNMENT: { passageLabel: "Passage", reasoningHint: "political science concepts" },
  AP_COMPARATIVE_GOVERNMENT: { passageLabel: "Passage", reasoningHint: "comparative government concepts" },
  AP_CALCULUS_AB: { passageLabel: "Graph/Reference data", reasoningHint: "calculus concepts and mathematical reasoning" },
  AP_CALCULUS_BC: { passageLabel: "Graph/Reference data", reasoningHint: "calculus concepts and mathematical reasoning" },
  AP_PRECALCULUS: { passageLabel: "Graph/Reference data", reasoningHint: "precalculus concepts and mathematical reasoning" },
  SAT_RW: { passageLabel: "Passage", reasoningHint: "Digital SAT R&W: grammar, rhetoric, evidence, vocabulary in context" },
  SAT_MATH: { passageLabel: "Reference data/figure", reasoningHint: "Digital SAT Math: algebra, problem-solving, advanced math; for grid-in return the numeric answer (e.g. 3/2 or 0.5)" },
  SAT_FULL_TEST: { passageLabel: "Reference data/passage", reasoningHint: "Digital SAT: R&W passages or Math figures; for grid-in return the numeric answer (e.g. 3/2 or 0.5)" },
};

export interface SolveQuestionInput {
  id: string;
  question_number: number;
  question_text: string;
  passage_text: string | null;
  precondition_text: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  page_number?: number | null;
  has_graph?: boolean;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  question_type?: "mcq" | "grid_in" | null;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function buildOptions(q: SolveQuestionInput): string[] {
  return [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
    .filter((o): o is string => o != null && o.trim() !== "")
    .map((o, i) => `${OPTION_KEYS[i]}. ${o.trim()}`);
}

const OUTPUT_INSTRUCTION = `
Return ONLY a JSON array of single uppercase letters in the same order as the questions.
Example: ["A","C","B","D"] means: question 1 -> A, question 2 -> C, question 3 -> B, question 4 -> D.
Each element must be exactly one of: "A", "B", "C", "D", "E".
CRITICAL: Solve each question independently. Return varied answers—different questions typically have different correct answers (A, B, C, D, or E). Returning the same letter for ALL questions is almost always wrong and indicates a failure to solve. Pick the best answer for each question.
Do not include markdown, explanation, or any other text.`;

const OUTPUT_INSTRUCTION_SAT = `
Return ONLY a JSON array, one entry per question, in the same order.
- For multiple-choice (MCQ) questions: an uppercase letter "A", "B", "C", or "D" (SAT never has E).
- For grid-in (Student-Produced Response) questions: a numeric string. Use fractions ("3/2") OR decimals ("1.5"); no spaces, no units.
Example: ["A","3/2","C","0.25","B"]
CRITICAL: Solve each question independently. Returning the same answer for ALL questions is almost always wrong. Pick the best answer per question.
Do not include markdown, explanation, or any other text.`;

/** CSA/CSP: code + question + precondition + options */
export function buildCsaSolvePrompt(questions: SolveQuestionInput[], subject: SubjectKey): string {
  const expertLabel = SUBJECT_LABELS[subject];
  const blocks = questions.map((q, i) => {
    const opts = buildOptions(q);
    const pre = q.precondition_text?.trim();
    return `
--- Question ${i + 1} ---
${pre ? `Precondition:\n${pre}\n\n` : ""}Reference code (Java):
\`\`\`
${(q.passage_text ?? "").trim() || "(no code)"}
\`\`\`

Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
  });

  return `You are an expert in ${expertLabel}. Solve each multiple-choice question below. Use the reference code and your knowledge to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

function formatQuestionBlock(
  q: SolveQuestionInput,
  i: number,
  withPdfHint: boolean,
  passageLabel = "Graph/Table/Reference data"
): string {
  const isGridIn = q.question_type === "grid_in";
  const opts = isGridIn ? [] : buildOptions(q);
  const passage = (q.passage_text ?? "").trim();
  const pageHint = withPdfHint && q.has_graph && q.page_number != null
    ? ` (Page ${q.page_number} – graph/table is on this page in the attached PDF)`
    : "";
  const optionsBlock = isGridIn
    ? `Answer format: GRID-IN (Student-Produced Response). Provide a numeric answer as a string (e.g. "3/2", "0.5", "-2"). No A/B/C/D.`
    : `Options:\n${opts.join("\n")}`;
  return `
--- Question ${i + 1}${pageHint} ---
${passage ? `${passageLabel}:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

${optionsBlock}`;
}

function isSatSolveSubject(subject: SubjectKey): boolean {
  return subject === "SAT_RW" || subject === "SAT_MATH" || subject === "SAT_FULL_TEST";
}

function buildGenericSolvePrompt(
  subject: SubjectKey,
  questions: SolveQuestionInput[],
  usePdf: boolean,
  passageLabel: string,
  reasoningHint: string
): string {
  const expertLabel = SUBJECT_LABELS[subject];
  const blocks = questions.map((q, i) => formatQuestionBlock(q, i, usePdf, passageLabel));
  const pdfLine = usePdf
    ? `The PDF document is attached. For questions that reference a graph, table, or diagram, look at the specified page (1-based) in the PDF. `
    : "";
  const isSat = isSatSolveSubject(subject);
  const hasGridIn = questions.some((q) => q.question_type === "grid_in");
  const outputInstruction = isSat ? OUTPUT_INSTRUCTION_SAT : OUTPUT_INSTRUCTION;
  const gridInHint = hasGridIn
    ? ` Some questions are grid-in (Student-Produced Response): respond with a numeric string instead of a letter (e.g. "3/2" or "0.5").`
    : "";
  return `You are an expert in ${expertLabel}. ${pdfLine}Solve each question. Use the ${passageLabel.toLowerCase()} when provided. Apply ${reasoningHint} to pick the correct answer.${gridInHint}

${blocks.join("\n")}

${outputInstruction}`;
}

export function buildSolvePrompt(subject: SubjectKey, questions: SolveQuestionInput[]): string {
  if (subject === "AP_CSA" || subject === "AP_CSP") {
    return buildCsaSolvePrompt(questions, subject);
  }
  const config = SUBJECT_SOLVE_CONFIG[subject];
  return buildGenericSolvePrompt(subject, questions, false, config.passageLabel, config.reasoningHint);
}

/** Build prompt with optional PDF attachment. Returns prompt and whether PDF should be attached. */
export function buildSolvePromptWithOptionalPdf(
  subject: SubjectKey,
  questions: SolveQuestionInput[],
  pdfBase64: string | null
): { prompt: string; usePdf: boolean } {
  const batchHasGraph = questions.some((q) => q.has_graph === true);
  const canUsePdf = batchHasGraph && !!pdfBase64?.trim();
  if (subject === "AP_CSA" || subject === "AP_CSP") {
    return { prompt: buildCsaSolvePrompt(questions, subject), usePdf: false };
  }
  const config = SUBJECT_SOLVE_CONFIG[subject];
  return {
    prompt: buildGenericSolvePrompt(subject, questions, canUsePdf, config.passageLabel, config.reasoningHint),
    usePdf: canUsePdf,
  };
}

function normalizeAnswer(s: string): string | null {
  const valid = ["A", "B", "C", "D", "E"];
  const t = String(s ?? "").toUpperCase().trim();
  return valid.includes(t) ? t : null;
}

/** Loose numeric/letter normalizer used for SAT (mixes MCQ letters and grid-in numerics). */
function normalizeAnswerLoose(s: string): string | null {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (["A", "B", "C", "D", "E"].includes(upper)) return upper;
  // numeric / fraction (allow leading -, digits, optional . or / )
  if (/^-?[\d./]+$/.test(raw) && /\d/.test(raw)) {
    return raw;
  }
  return null;
}

/** Parse Gemini response into array of A/B/C/D/E. Handles JSON, numbered lists, comma-separated, Q1: A format. */
export function parseSolveResponse(text: string, expectedCount: number): (string | null)[] {
  const valid = ["A", "B", "C", "D", "E"];
  const cleaned = text.trim();

  const jsonMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(arr)) {
        return arr
          .slice(0, expectedCount)
          .map((a) => normalizeAnswerLoose(String(a ?? "")));
      }
    } catch {
      // fallback
    }
  }

  const letterMatch = cleaned.match(/["']?([A-E])["']?/g);
  if (letterMatch && letterMatch.length >= expectedCount) {
    return letterMatch.slice(0, expectedCount).map((m) => {
      const s = m.replace(/["']/g, "").toUpperCase();
      return valid.includes(s) ? s : null;
    });
  }

  const numberedList = cleaned.match(/^\s*\d+\.\s*([A-E])\b/gm);
  if (numberedList && numberedList.length >= expectedCount) {
    return numberedList.slice(0, expectedCount).map((m) => {
      const s = m.replace(/^\s*\d+\.\s*/i, "").toUpperCase().trim();
      return valid.includes(s) ? s : null;
    });
  }

  const qFormat = cleaned.match(/(?:Q(?:uestion)?\s*\d+\s*[:=]\s*)?([A-E])\b/gim);
  if (qFormat && qFormat.length >= expectedCount) {
    return qFormat.slice(0, expectedCount).map((m) => {
      const s = m.replace(/^.*([A-E])$/i, "$1").toUpperCase();
      return valid.includes(s) ? s : null;
    });
  }

  const commaSepLetters = cleaned.split(/[,;\n]+/).map((p) => p.replace(/[^A-Ea-e]/g, "").toUpperCase().trim()).filter(Boolean);
  if (commaSepLetters.length >= expectedCount) {
    return commaSepLetters.slice(0, expectedCount).map((l) => normalizeAnswer(l));
  }

  // anyLetter fallback removed: too risky - can match A/B/C/D/E from prompt text (e.g. "Choose A, B, C, or D")
  return new Array(expectedCount).fill(null);
}

/**
 * Check if a free-form numeric grid-in answer matches the accepted set.
 * Compares as: (a) exact string after trim, (b) numeric value within 1e-6
 * tolerance after evaluating fractions like "3/2" -> 1.5.
 */
export function gridInAnswerMatches(
  userAnswer: string | null | undefined,
  acceptedAnswers: string[] | null | undefined
): boolean {
  if (!userAnswer || !acceptedAnswers || acceptedAnswers.length === 0) return false;
  const u = userAnswer.trim();
  if (!u) return false;
  for (const candidate of acceptedAnswers) {
    if (typeof candidate !== "string") continue;
    const c = candidate.trim();
    if (!c) continue;
    if (u === c) return true;
    const uVal = parseNumericMaybeFraction(u);
    const cVal = parseNumericMaybeFraction(c);
    if (uVal != null && cVal != null && Math.abs(uVal - cVal) < 1e-6) return true;
  }
  return false;
}

function parseNumericMaybeFraction(s: string): number | null {
  const t = s.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
  }
  return null;
}
