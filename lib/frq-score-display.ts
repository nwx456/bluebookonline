import type { RubricRow } from "@/components/frq/FrqScoreReportCard";

export function computePointsLost(earned: number | null, max: number): number {
  if (max <= 0) return 0;
  const safeEarned = Math.max(0, earned ?? 0);
  return Math.max(0, max - safeEarned);
}

export function getMissedRubricRows(breakdown: RubricRow[] | null | undefined): RubricRow[] {
  if (!breakdown?.length) return [];
  return breakdown.filter((row) => computePointsLost(row.earned_points, row.max_points) > 0);
}

export function formatPointsLostLabel(lost: number, max: number): string {
  if (lost <= 0) return "Full credit";
  return `Lost ${lost} of ${max} pts`;
}
