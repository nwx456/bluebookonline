/**
 * Ders bazlı AI solve prompt'ları.
 * correct_answer boş soruları çözmek için Gemini'ye gönderilecek.
 */

import type { SubjectKey } from "./gemini-prompts";

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

/** CSA: Java code + question + precondition + options */
export function buildCsaSolvePrompt(questions: SolveQuestionInput[]): string {
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

  return `You are an expert in AP Computer Science A (Java). Solve each multiple-choice question below. Use the reference code and your Java knowledge to pick the correct answer.

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

/** Economics (Micro/Macro): stem + passage (graph/table) + options */
export function buildEconomicsSolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatQuestionBlock(q, i, false));
  return `You are an expert in AP Microeconomics and Macroeconomics. Solve each multiple-choice question. Use the graph, table, or reference data when provided. Apply economic reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Economics with PDF: attach PDF for graph/table questions */
export function buildEconomicsSolvePromptWithPdf(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatQuestionBlock(q, i, true));
  return `You are an expert in AP Microeconomics and Macroeconomics. The PDF document is attached. For questions that reference a graph or table, look at the specified page (1-based) in the PDF. Solve each multiple-choice question. Apply economic reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Psychology: stem + passage + options */
export function buildPsychologySolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatQuestionBlock(q, i, false, "Passage"));
  return `You are an expert in AP Psychology. Solve each multiple-choice question. Use the passage when provided. Apply psychology concepts to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Psychology with PDF: attach PDF for graph/diagram questions */
export function buildPsychologySolvePromptWithPdf(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatQuestionBlock(q, i, true, "Passage"));
  return `You are an expert in AP Psychology. The PDF document is attached. For questions that reference a graph or diagram, look at the specified page (1-based) in the PDF. Solve each multiple-choice question. Apply psychology concepts to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

function formatStatsQuestionBlock(q: SolveQuestionInput, i: number, withPdfHint: boolean): string {
  const opts = buildOptions(q);
  const passage = (q.passage_text ?? "").trim();
  const pageHint = withPdfHint && q.has_graph && q.page_number != null
    ? ` (Page ${q.page_number} – data/table is on this page in the attached PDF)`
    : "";
  return `
--- Question ${i + 1}${pageHint} ---
${passage ? `Data/Table/Reference:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
}

/** Statistics: stem + passage/table + options */
export function buildStatisticsSolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatStatsQuestionBlock(q, i, false));
  return `You are an expert in AP Statistics. Solve each multiple-choice question. Use the data, table, or reference when provided. Apply statistical reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Statistics with PDF: attach PDF for data/table questions */
export function buildStatisticsSolvePromptWithPdf(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => formatStatsQuestionBlock(q, i, true));
  return `You are an expert in AP Statistics. The PDF document is attached. For questions that reference data or a table, look at the specified page (1-based) in the PDF. Solve each multiple-choice question. Apply statistical reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

export function buildSolvePrompt(subject: SubjectKey, questions: SolveQuestionInput[]): string {
  switch (subject) {
    case "AP_CSA":
    case "AP_CSP":
      return buildCsaSolvePrompt(questions);
    case "AP_MICROECONOMICS":
    case "AP_MACROECONOMICS":
    case "AP_BIOLOGY":
    case "AP_CHEMISTRY":
    case "AP_PHYSICS_1":
    case "AP_PHYSICS_2":
    case "AP_PHYSICS_C_MECH":
    case "AP_PHYSICS_C_EM":
    case "AP_ENVIRONMENTAL_SCIENCE":
    case "AP_HUMAN_GEOGRAPHY":
      return buildEconomicsSolvePrompt(questions);
    case "AP_PSYCHOLOGY":
    case "AP_ENGLISH_LANG":
    case "AP_ENGLISH_LIT":
    case "AP_US_HISTORY":
    case "AP_WORLD_HISTORY":
    case "AP_EUROPEAN_HISTORY":
    case "AP_US_GOVERNMENT":
    case "AP_COMPARATIVE_GOVERNMENT":
    case "AP_CALCULUS_AB":
    case "AP_CALCULUS_BC":
    case "AP_PRECALCULUS":
      return buildPsychologySolvePrompt(questions);
    case "AP_STATISTICS":
      return buildStatisticsSolvePrompt(questions);
    default:
      return buildPsychologySolvePrompt(questions);
  }
}

/** Build prompt with optional PDF attachment. Returns prompt and whether PDF should be attached. */
export function buildSolvePromptWithOptionalPdf(
  subject: SubjectKey,
  questions: SolveQuestionInput[],
  pdfBase64: string | null
): { prompt: string; usePdf: boolean } {
  const batchHasGraph = questions.some((q) => q.has_graph === true);
  const canUsePdf = batchHasGraph && !!pdfBase64?.trim();
  switch (subject) {
    case "AP_CSA":
    case "AP_CSP":
      return { prompt: buildCsaSolvePrompt(questions), usePdf: false };
    case "AP_MICROECONOMICS":
    case "AP_MACROECONOMICS":
    case "AP_BIOLOGY":
    case "AP_CHEMISTRY":
    case "AP_PHYSICS_1":
    case "AP_PHYSICS_2":
    case "AP_PHYSICS_C_MECH":
    case "AP_PHYSICS_C_EM":
    case "AP_ENVIRONMENTAL_SCIENCE":
    case "AP_HUMAN_GEOGRAPHY":
      return {
        prompt: canUsePdf ? buildEconomicsSolvePromptWithPdf(questions) : buildEconomicsSolvePrompt(questions),
        usePdf: canUsePdf,
      };
    case "AP_PSYCHOLOGY":
    case "AP_ENGLISH_LANG":
    case "AP_ENGLISH_LIT":
    case "AP_US_HISTORY":
    case "AP_WORLD_HISTORY":
    case "AP_EUROPEAN_HISTORY":
    case "AP_US_GOVERNMENT":
    case "AP_COMPARATIVE_GOVERNMENT":
    case "AP_CALCULUS_AB":
    case "AP_CALCULUS_BC":
    case "AP_PRECALCULUS":
      return {
        prompt: canUsePdf ? buildPsychologySolvePromptWithPdf(questions) : buildPsychologySolvePrompt(questions),
        usePdf: canUsePdf,
      };
    case "AP_STATISTICS":
      return {
        prompt: canUsePdf ? buildStatisticsSolvePromptWithPdf(questions) : buildStatisticsSolvePrompt(questions),
        usePdf: canUsePdf,
      };
    default:
      return {
        prompt: canUsePdf ? buildPsychologySolvePromptWithPdf(questions) : buildPsychologySolvePrompt(questions),
        usePdf: canUsePdf,
      };
  }
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
