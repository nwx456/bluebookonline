/** Scale raw correct count -> SAT section scaled score (200-800). */
export function scaleSectionScore(
  correct: number,
  totalAvailable: number,
  useSixModule: boolean,
  hardM2: boolean,
): number {
  if (totalAvailable <= 0) return 200;
  const ratio = Math.max(0, Math.min(1, correct / totalAvailable));
  let score = Math.round(200 + ratio * 600);
  if (useSixModule && hardM2) score = Math.min(800, score + 30);
  return Math.max(200, Math.min(800, score));
}

export type SatModule2Variant = "easy" | "hard";

export interface SatModuleScoreInput {
  rwM1: number;
  rwM2: number;
  mathM1: number;
  mathM2: number;
  rwM2Variant: SatModule2Variant;
  mathM2Variant: SatModule2Variant;
}

export const SAT_RW_MODULE_MAX = 27;
export const SAT_MATH_MODULE_MAX = 22;

export function computeSatScores(input: SatModuleScoreInput): {
  rwScaled: number;
  mathScaled: number;
  totalScaled: number;
} {
  const rwCorrect =
    Math.min(SAT_RW_MODULE_MAX, Math.max(0, input.rwM1)) +
    Math.min(SAT_RW_MODULE_MAX, Math.max(0, input.rwM2));
  const mathCorrect =
    Math.min(SAT_MATH_MODULE_MAX, Math.max(0, input.mathM1)) +
    Math.min(SAT_MATH_MODULE_MAX, Math.max(0, input.mathM2));

  const rwScaled = scaleSectionScore(
    rwCorrect,
    SAT_RW_MODULE_MAX * 2,
    true,
    input.rwM2Variant === "hard",
  );
  const mathScaled = scaleSectionScore(
    mathCorrect,
    SAT_MATH_MODULE_MAX * 2,
    true,
    input.mathM2Variant === "hard",
  );

  return {
    rwScaled,
    mathScaled,
    totalScaled: rwScaled + mathScaled,
  };
}

/** Approximate national percentile for total score (Digital SAT era estimates). */
export function estimateSatTotalPercentile(total: number): number {
  if (total >= 1530) return 99;
  if (total >= 1450) return 96;
  if (total >= 1350) return 90;
  if (total >= 1250) return 81;
  if (total >= 1150) return 68;
  if (total >= 1050) return 50;
  if (total >= 950) return 33;
  if (total >= 850) return 18;
  if (total >= 750) return 8;
  return 3;
}

export const SAT_SCORE_CALCULATOR_DISCLAIMER =
  "This calculator provides an estimate only. The College Board uses Item Response Theory and annual equating; official cutoffs vary by test form. Not affiliated with the College Board.";
