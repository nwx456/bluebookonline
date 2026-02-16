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
}

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function buildOptions(q: SolveQuestionInput): string[] {
  return [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
    .filter((o): o is string => o != null && o.trim() !== "")
    .map((o, i) => `${OPTION_KEYS[i]}. ${o.trim()}`);
}

const OUTPUT_INSTRUCTION = `
Return ONLY a JSON array of single uppercase letters in the same order as the questions.
Example: ["A","C","B"] means: question 1 -> A, question 2 -> C, question 3 -> B.
Each element must be exactly one of: "A", "B", "C", "D", "E".
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

/** Economics (Micro/Macro): stem + passage (graph/table) + options */
export function buildEconomicsSolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => {
    const opts = buildOptions(q);
    const passage = (q.passage_text ?? "").trim();
    return `
--- Question ${i + 1} ---
${passage ? `Graph/Table/Reference data:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
  });

  return `You are an expert in AP Microeconomics and Macroeconomics. Solve each multiple-choice question. Use the graph, table, or reference data when provided. Apply economic reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Psychology: stem + passage + options */
export function buildPsychologySolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => {
    const opts = buildOptions(q);
    const passage = (q.passage_text ?? "").trim();
    return `
--- Question ${i + 1} ---
${passage ? `Passage:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
  });

  return `You are an expert in AP Psychology. Solve each multiple-choice question. Use the passage when provided. Apply psychology concepts to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

/** Statistics: stem + passage/table + options */
export function buildStatisticsSolvePrompt(questions: SolveQuestionInput[]): string {
  const blocks = questions.map((q, i) => {
    const opts = buildOptions(q);
    const passage = (q.passage_text ?? "").trim();
    return `
--- Question ${i + 1} ---
${passage ? `Data/Table/Reference:\n${passage}\n\n` : ""}Question: ${q.question_text.trim()}

Options:
${opts.join("\n")}`;
  });

  return `You are an expert in AP Statistics. Solve each multiple-choice question. Use the data, table, or reference when provided. Apply statistical reasoning to pick the correct answer.

${blocks.join("\n")}

${OUTPUT_INSTRUCTION}`;
}

export function buildSolvePrompt(subject: SubjectKey, questions: SolveQuestionInput[]): string {
  switch (subject) {
    case "AP_CSA":
      return buildCsaSolvePrompt(questions);
    case "AP_MICROECONOMICS":
    case "AP_MACROECONOMICS":
      return buildEconomicsSolvePrompt(questions);
    case "AP_PSYCHOLOGY":
      return buildPsychologySolvePrompt(questions);
    case "AP_STATISTICS":
      return buildStatisticsSolvePrompt(questions);
    default:
      return buildPsychologySolvePrompt(questions);
  }
}

/** Parse Gemini response into array of A/B/C/D/E. */
export function parseSolveResponse(text: string, expectedCount: number): (string | null)[] {
  const valid = ["A", "B", "C", "D", "E"];
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]) as unknown;
      if (Array.isArray(arr)) {
        return arr.slice(0, expectedCount).map((a) => {
          const s = String(a ?? "").toUpperCase().trim();
          return valid.includes(s) ? s : null;
        });
      }
    } catch {
      // fallback
    }
  }
  const letterMatch = cleaned.match(/["']?([A-E])["']?/g);
  if (letterMatch) {
    return letterMatch.slice(0, expectedCount).map((m) => {
      const s = m.replace(/["']/g, "").toUpperCase();
      return valid.includes(s) ? s : null;
    });
  }
  return new Array(expectedCount).fill(null);
}
