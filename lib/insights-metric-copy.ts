export type InsightsMetricKey =
  | "attempts"
  | "avgScore"
  | "best"
  | "trend"
  | "scoreOverTime"
  | "weeklyActivity"
  | "subjectPerformance"
  | "satSections"
  | "accuracyTrend";

export interface InsightsMetricCopy {
  title: string;
  description: string;
}

export const INSIGHTS_METRIC_COPY: Record<InsightsMetricKey, InsightsMetricCopy> = {
  attempts: {
    title: "Attempts",
    description:
      "The number of completed, non-archived exam attempts in the current scope. Archived attempts are excluded.",
  },
  avgScore: {
    title: "Average score",
    description:
      "The mean score across all scored attempts in the current scope. For AP and FRQ exams this is the percentage score; for SAT it is the total scaled score (400–1600).",
  },
  best: {
    title: "Best score",
    description:
      "The highest score achieved among all scored attempts in the current scope.",
  },
  trend: {
    title: "Trend",
    description:
      "The difference between your most recent scored attempt and the one before it (latest minus previous). A positive value means improvement; negative means a drop.",
  },
  scoreOverTime: {
    title: "Score over time",
    description:
      "A chronological line chart showing your score on each completed attempt in the current scope.",
  },
  weeklyActivity: {
    title: "Weekly activity",
    description:
      "The number of completed attempts per ISO calendar week over the last eight weeks.",
  },
  subjectPerformance: {
    title: "Subject performance",
    description:
      "Average score and mistake count grouped by subject or course. Helps you compare strengths and weak areas across subjects.",
  },
  satSections: {
    title: "SAT sections",
    description:
      "Breakdown of mistakes and average module scaled scores for Reading & Writing versus Math on SAT attempts in the current scope.",
  },
  accuracyTrend: {
    title: "Accuracy trend",
    description:
      "The percentage of questions answered correctly on each attempt (correct ÷ total × 100). For FRQ attempts, the graded percentage is used instead.",
  },
};
