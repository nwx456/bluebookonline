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
  const opts = buildOptions(q);
  const passage = (q.passage_text ?? "").trim();
  const pageHint = withPdfHint && q.has_graph && q.page_number != null
    ? ` (Page ${q.page_number} – graph/table is on this page in the attached PDF)`
    : "";
  return `
--- Question ${i + 1}${pageHint} ---
${passage ? `${passageLabel}:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
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
  return `You are an expert in ${expertLabel}. ${pdfLine}Solve each multiple-choice question. Use the ${passageLabel.toLowerCase()} when provided. Apply ${reasoningHint} to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
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

/** Parse Gemini response into array of A/B/C/D/E. Handles JSON, numbered lists, comma-separated, Q1: A format. */
export function parseSolveResponse(text: string, expectedCount: number): (string | null)[] {
  const valid = ["A", "B", "C", "D", "E"];
  const cleaned = text.trim();

  const jsonMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(arr)) {
        return arr.slice(0, expectedCount).map((a) => normalizeAnswer(String(a ?? "")));
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
