import { cn } from "@/lib/utils";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { SUBJECT_META } from "@/lib/subject-meta";
import {
  AP_SCORE_DISCLAIMER,
  estimateApScore,
  getApScoreDescriptor,
} from "@/lib/ap-score-estimate";
import { formatScoreReportDate, scoreReport } from "@/app/exam/score-report-tokens";

type Props = {
  subject: SubjectKey;
  filename?: string | null;
  completedAt?: string | null;
  percentage: number | null;
  correctCount: number;
  incorrectCount: number;
  total: number;
  skipAiGrading?: boolean;
  notGradedCount?: number;
  variant?: "full" | "compact";
  className?: string;
};

function CampusLineArt() {
  return (
    <svg
      viewBox="0 0 120 28"
      className="mx-auto mt-2 h-7 w-[120px] text-[#374151]"
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        d="M4 22V12l8-6 8 6v10M28 22V10l10-7 10 7v12M52 22V14l6-4 6 4v8M72 22V11l9-6 9 6v11M96 22V15l5-3 5 3v7"
      />
      <path fill="none" stroke="currentColor" strokeWidth="1" d="M0 22h120" />
    </svg>
  );
}

export function ApScoreReportCard({
  subject,
  filename,
  completedAt,
  percentage,
  correctCount,
  incorrectCount,
  total,
  skipAiGrading = false,
  notGradedCount = 0,
  variant = "full",
  className,
}: Props) {
  const subjectLabel =
    SUBJECT_META[subject]?.fullName ?? SUBJECT_LABELS[subject] ?? subject;
  const gradedAnswered = correctCount + incorrectCount;
  const headlineIsScore = !(skipAiGrading && gradedAnswered === 0);
  const estimatedScore = headlineIsScore ? estimateApScore(percentage) : null;
  const isCompact = variant === "compact";

  return (
    <div className={cn(scoreReport.card, className)}>
      <div className={cn(scoreReport.headerNavy, isCompact ? "px-4 py-3" : "px-6 py-4")}>
        <p
          className={cn(
            "font-medium leading-snug text-center",
            isCompact ? "text-sm" : "text-base sm:text-lg"
          )}
        >
          {subjectLabel}
        </p>
        {!isCompact && filename ? (
          <p className="mt-1 text-center text-xs text-white/75 truncate">{filename}</p>
        ) : null}
      </div>

      <div className={cn("text-center", isCompact ? "px-4 py-5" : "px-6 py-8")}>
        <p className={scoreReport.labelMuted}>Your Score</p>
        <div className="mx-auto mt-4 flex flex-col items-center">
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-full border-2 border-[#111827]",
              isCompact ? "h-24 w-24" : "h-36 w-36 sm:h-40 sm:w-40"
            )}
          >
            <span
              className={cn(
                scoreReport.scoreNumber,
                isCompact ? "text-4xl" : "text-6xl sm:text-7xl"
              )}
            >
              {estimatedScore ?? "—"}
            </span>
            {!isCompact ? <CampusLineArt /> : null}
          </div>
          {estimatedScore != null ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]">
              Estimated AP
            </p>
          ) : null}
        </div>

        <p className={cn(scoreReport.bodyText, "mt-5 max-w-md mx-auto")}>
          {getApScoreDescriptor(estimatedScore)}
        </p>

        {headlineIsScore && percentage != null ? (
          <p className="mt-2 text-xs text-[#6b7280] tabular-nums">
            {correctCount}/{total} correct · {percentage}% MCQ
          </p>
        ) : null}

        {completedAt && !isCompact ? (
          <p className="mt-1 text-xs text-[#9ca3af]">{formatScoreReportDate(completedAt)}</p>
        ) : null}
      </div>

      {!isCompact ? (
        <div className={cn(scoreReport.sectionDivider, "px-6 py-3")}>
          <p className={scoreReport.disclaimer}>{AP_SCORE_DISCLAIMER}</p>
        </div>
      ) : null}
    </div>
  );
}
