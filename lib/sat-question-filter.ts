/**
 * SAT-only salvage filter: keep what Gemini returned; drop only truly empty rows.
 */

import { looksLikeGridInStem } from "@/lib/sat-ingest-postprocess";

export interface SalvageFilterQuestion {
  content?: string | null;
  question?: string | null;
  image_description?: string | null;
  options?: unknown;
  correct?: string | null;
  question_type?: string | null;
  accepted_answers?: string[] | null;
}

export interface SalvageFilterResult<T extends SalvageFilterQuestion> {
  kept: T[];
  dropped: T[];
  dropReasons: string[];
}

const PASSAGE_MIN = 20;

function stemText(q: SalvageFilterQuestion): string {
  const raw =
    (typeof q.content === "string" && q.content.trim()) ||
    (typeof q.question === "string" && q.question.trim()) ||
    "";
  return raw;
}

function passageText(q: SalvageFilterQuestion): string {
  return (typeof q.image_description === "string" ? q.image_description : "").trim();
}

function optionTexts(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.map((o) => (typeof o === "string" ? o.trim() : String(o ?? "").trim()));
}

function hasAnyOptionText(options: unknown): boolean {
  return optionTexts(options).some((t) => t.length > 0);
}

function isGridInCandidate(q: SalvageFilterQuestion): boolean {
  const qtype = typeof q.question_type === "string" ? q.question_type.toLowerCase().trim() : "";
  if (qtype === "grid_in" || qtype === "grid-in" || qtype === "gridin") return true;
  const stem = stemText(q);
  if (looksLikeGridInStem(stem)) return true;
  const hasAccepted = Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0;
  const hasNumericCorrect =
    typeof q.correct === "string" && /\d/.test(q.correct);
  return hasAccepted || hasNumericCorrect;
}

function shouldKeepSalvageQuestion(q: SalvageFilterQuestion): boolean {
  const stem = stemText(q);
  const passage = passageText(q);
  if (stem.length > 0) return true;
  if (passage.length >= PASSAGE_MIN) return true;
  if (hasAnyOptionText(q.options)) return true;
  if (isGridInCandidate(q)) return true;
  return false;
}

/** Minimal SAT filter — salvage-first; does not drop placeholder A,B,C,D MCQs. */
export function salvageFilterSatQuestions<T extends SalvageFilterQuestion>(
  questions: T[]
): SalvageFilterResult<T> {
  const kept: T[] = [];
  const dropped: T[] = [];
  const dropReasons: string[] = [];

  for (const q of questions) {
    if (shouldKeepSalvageQuestion(q)) {
      kept.push(q);
    } else {
      dropped.push(q);
      dropReasons.push("empty_row");
    }
  }

  return { kept, dropped, dropReasons };
}

/**
 * Defensive layer: after bucket tagging (applyBucketToQuestion) every row
 * MUST have a non-empty sat_section. If somehow it doesn't, drop the row so
 * it never contaminates other modules during grading.
 */
export function dropRowsWithoutSection<
  T extends { sat_section?: string | null; sat_module?: number | null }
>(questions: T[]): T[] {
  return questions.filter((q) => {
    const section =
      typeof q.sat_section === "string" ? q.sat_section.toLowerCase().trim() : "";
    if (section !== "rw" && section !== "math") return false;
    const modNum =
      q.sat_module === 1 || q.sat_module === 2 ? q.sat_module : null;
    return modNum != null;
  });
}
