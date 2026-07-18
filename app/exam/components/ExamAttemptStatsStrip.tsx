import { cn } from "@/lib/utils";
import { formatAttemptDuration } from "@/app/exam/score-report-tokens";

type Props = {
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  notGradedCount?: number;
  total: number;
  timeSpentSeconds?: number;
  compact?: boolean;
  className?: string;
};

export function ExamAttemptStatsStrip({
  correctCount,
  incorrectCount,
  unansweredCount,
  notGradedCount = 0,
  total,
  timeSpentSeconds,
  compact = false,
  className,
}: Props) {
  const parts = [
    `${correctCount} correct`,
    `${incorrectCount} incorrect`,
    `${unansweredCount} unanswered`,
  ];
  if (notGradedCount > 0) parts.push(`${notGradedCount} not graded`);
  parts.push(`${total} total`);
  if (timeSpentSeconds != null && timeSpentSeconds >= 0) {
    parts.push(formatAttemptDuration(timeSpentSeconds));
  }

  return (
    <p
      className={cn(
        "text-center tabular-nums text-[#6b7280]",
        compact ? "text-[11px]" : "text-xs",
        className
      )}
    >
      {parts.join(" · ")}
    </p>
  );
}
