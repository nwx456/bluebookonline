export type ApEstimatedScore = 1 | 2 | 3 | 4 | 5;

/** Map MCQ practice percentage to an estimated AP score (1–5). */
export function estimateApScore(percentage: number | null): ApEstimatedScore | null {
  if (percentage == null || Number.isNaN(percentage)) return null;
  if (percentage >= 85) return 5;
  if (percentage >= 70) return 4;
  if (percentage >= 55) return 3;
  if (percentage >= 40) return 2;
  return 1;
}

const AP_SCORE_DESCRIPTORS: Record<ApEstimatedScore, string> = {
  5: "Most U.S. colleges accept your score for credit and placement.",
  4: "A strong score that may qualify for college credit at many institutions.",
  3: "A qualifying score on many AP exams. Check college policies for credit.",
  2: "Below the typical qualifying threshold. Review missed topics and try again.",
  1: "Keep practicing. Focus on core concepts before your next attempt.",
};

export function getApScoreDescriptor(score: ApEstimatedScore | null): string {
  if (score == null) return "Complete graded questions to see an estimated score.";
  return AP_SCORE_DESCRIPTORS[score];
}

export const AP_SCORE_DISCLAIMER =
  "Estimated from multiple-choice practice only. Official AP scores include free-response sections and College Board scaling.";
