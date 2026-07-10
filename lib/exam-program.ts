/**
 * SAT vs AP program helpers.
 *
 * Subject keys with prefix "SAT_" belong to the SAT program; everything else
 * (existing "AP_*" keys) belongs to AP. SAT-specific behavior (Desmos
 * calculator, scaled scoring, module-by-module exam flow, A-D only options,
 * grid-in numeric inputs) is gated through these helpers.
 */

export type ExamProgram = "AP" | "SAT";

export type SatSection = "rw" | "math";
export type SatModuleNumber = 1 | 2;
export type SatModuleId = "rw1" | "rw2" | "math1" | "math2";
export type SatAdaptiveMode = "none" | "six_module";
export type SatFormat = "single_module" | "section_test" | "full_test";
export type SatModuleVariant = "easy" | "hard";
export type SatDifficulty = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "grid_in";

/** One extraction batch target for SAT Full Test uploads. */
export interface SatModuleBucket {
  section: SatSection;
  module: SatModuleNumber;
  variant: SatModuleVariant | null;
  pdfLabels: string[];
  detectedTitle?: string | null;
  /** From structure discovery; guides extraction count for this bucket. */
  expectedCount?: number;
}

export interface SatModuleDef {
  id: SatModuleId;
  section: SatSection;
  module: SatModuleNumber;
  label: string;
  shortLabel: string;
  durationMin: number;
  questionCount: number;
}

export const SAT_MODULES: readonly SatModuleDef[] = [
  {
    id: "rw1",
    section: "rw",
    module: 1,
    label: "Reading & Writing – Module 1",
    shortLabel: "R&W M1",
    durationMin: 32,
    questionCount: 27,
  },
  {
    id: "rw2",
    section: "rw",
    module: 2,
    label: "Reading & Writing – Module 2",
    shortLabel: "R&W M2",
    durationMin: 32,
    questionCount: 27,
  },
  {
    id: "math1",
    section: "math",
    module: 1,
    label: "Math – Module 1",
    shortLabel: "Math M1",
    durationMin: 35,
    questionCount: 22,
  },
  {
    id: "math2",
    section: "math",
    module: 2,
    label: "Math – Module 2",
    shortLabel: "Math M2",
    durationMin: 35,
    questionCount: 22,
  },
] as const;

export function getExamProgram(subject: string | null | undefined): ExamProgram {
  if (!subject) return "AP";
  return subject.startsWith("SAT_") ? "SAT" : "AP";
}

export function isSatSubject(subject: string | null | undefined): boolean {
  return getExamProgram(subject) === "SAT";
}

export function isSatFullTest(subject: string | null | undefined): boolean {
  return subject === "SAT_FULL_TEST";
}

export function isSatRw(subject: string | null | undefined): boolean {
  return subject === "SAT_RW" || subject === "SAT_FULL_TEST";
}

export function isSatMath(subject: string | null | undefined): boolean {
  return subject === "SAT_MATH" || subject === "SAT_FULL_TEST";
}

/** SAT_RW or SAT_MATH only (not full test). */
export function isSatSectionUpload(subject: string | null | undefined): boolean {
  return subject === "SAT_RW" || subject === "SAT_MATH";
}

export function satSectionForSubject(subject: string | null | undefined): SatSection | null {
  if (subject === "SAT_RW") return "rw";
  if (subject === "SAT_MATH") return "math";
  return null;
}

export function isSatSectionTest(
  subject: string | null | undefined,
  satFormat: string | null | undefined
): boolean {
  return isSatSectionUpload(subject) && satFormat === "section_test";
}

/** Module-by-module exam navigation (Submit Module, adaptive M2 routing). */
export function usesSatModuleFlow(opts: {
  subject: string | null | undefined;
  satFormat?: string | null | undefined;
}): boolean {
  const { subject, satFormat } = opts;
  if (isSatFullTest(subject)) return true;
  return isSatSectionTest(subject, satFormat);
}

/**
 * SAT Math always allows the built-in Desmos graphing calculator.
 * SAT R&W has no calculator. AP subjects use the existing
 * CALCULATOR_ALLOWED_SUBJECTS set in the exam page.
 */
export function requiresDesmos(subject: string | null | undefined): boolean {
  return subject === "SAT_MATH" || subject === "SAT_FULL_TEST";
}

export function getSatModuleById(id: SatModuleId | string | null | undefined): SatModuleDef | null {
  if (!id) return null;
  return SAT_MODULES.find((m) => m.id === id) ?? null;
}

export function getSatModuleByIndex(index: number): SatModuleDef | null {
  return SAT_MODULES[index] ?? null;
}

export function moduleIdFromSectionAndNumber(
  section: SatSection,
  module: SatModuleNumber
): SatModuleId {
  return `${section === "rw" ? "rw" : "math"}${module}` as SatModuleId;
}

/**
 * Order of modules in a full Digital SAT: RW M1 -> RW M2 -> Math M1 -> Math M2.
 * Each index is 0..3 and maps to a SAT_MODULES entry.
 */
export function nextModuleIndex(currentIndex: number): number | null {
  if (currentIndex < 0) return 0;
  if (currentIndex >= SAT_MODULES.length - 1) return null;
  return currentIndex + 1;
}

/**
 * For SAT_FULL_TEST with six_module adaptive mode, the M2 variant is chosen
 * based on the M1 correct count vs the optional cutoff. If no cutoff is
 * provided we use a sensible default (~60% of the M1 question count).
 */
export function pickSatM2Variant(
  m1CorrectCount: number,
  m1TotalQuestions: number,
  cutoff: number | null | undefined
): SatModuleVariant {
  const effectiveCutoff =
    cutoff != null && Number.isFinite(cutoff) && cutoff > 0
      ? cutoff
      : Math.ceil(m1TotalQuestions * 0.6);
  return m1CorrectCount >= effectiveCutoff ? "hard" : "easy";
}

/**
 * Default cutoffs for SAT M1 -> M2 hard variant routing.
 * Real Bluebook is internal, but ~60% correct is a workable starting point.
 */
export const DEFAULT_SAT_CUTOFF_RW = 18; // out of 27
export const DEFAULT_SAT_CUTOFF_MATH = 14; // out of 22
