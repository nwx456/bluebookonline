import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubjectKey } from "@/lib/subjects";
import {
  isSatFullTest,
  isSatMath,
  isSatRw,
  satSectionForSubject,
} from "@/lib/exam-program";
import { formatScoreReportDate, scoreReport } from "@/app/exam/score-report-tokens";

type SatScoreData = {
  isFullTest: boolean;
  rwScaled: number | null;
  mathScaled: number | null;
  totalScaled: number | null;
};

type Props = {
  subject: SubjectKey;
  filename?: string | null;
  completedAt?: string | null;
  sat: SatScoreData;
  variant?: "full" | "compact";
  /** Module preview mode — shows raw score instead of scaled */
  modulePreview?: {
    label: string;
    correctCount: number;
    totalCount: number;
    percentage: number;
  };
  className?: string;
};

function ScoreRange({ min, max }: { min: number; max: number }) {
  return (
    <span className="text-xs text-[#9ca3af] tabular-nums border-b border-dotted border-[#d1d5db] pb-0.5">
      {min}–{max}
    </span>
  );
}

function SectionRow({
  label,
  score,
  rangeMin,
  rangeMax,
  compact,
}: {
  label: string;
  score: number | null;
  rangeMin: number;
  rangeMax: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        scoreReport.sectionDivider,
        compact ? "px-4 py-3" : "px-6 py-4"
      )}
    >
      <div className="min-w-0">
        <p className={cn("font-semibold text-[#111827]", compact ? "text-sm" : "text-base")}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-[#6b7280]">
          <ScoreRange min={rangeMin} max={rangeMax} />
        </p>
      </div>
      <p
        className={cn(
          scoreReport.scoreNumber,
          "shrink-0",
          compact ? "text-2xl" : "text-3xl sm:text-4xl"
        )}
      >
        {score ?? "—"}
      </p>
    </div>
  );
}

export function SatScoreReportCard({
  subject,
  filename,
  completedAt,
  sat,
  variant = "full",
  modulePreview,
  className,
}: Props) {
  const isCompact = variant === "compact";
  const sectionOnly = satSectionForSubject(subject);
  const isFull = isSatFullTest(subject) || sat.isFullTest;
  const showRw = isFull || isSatRw(subject);
  const showMath = isFull || isSatMath(subject);

  const headerSubtitle = modulePreview
    ? "Module preview · exam in progress"
    : sectionOnly === "rw"
      ? "Reading and Writing"
      : sectionOnly === "math"
        ? "Math"
        : null;

  const bandTitle = modulePreview
    ? "Module Score"
    : isFull
      ? "Your Total Score"
      : "Your Score";

  const displayScore = modulePreview
    ? `${modulePreview.correctCount}/${modulePreview.totalCount}`
    : sat.totalScaled != null
      ? String(sat.totalScaled)
      : "—";

  const scoreMax = isFull ? 1600 : 800;
  const rangeMin = isFull ? 400 : 200;
  const rangeMax = isFull ? 1600 : 800;

  const formattedDate = formatScoreReportDate(completedAt);

  return (
    <div className={cn(scoreReport.card, className)}>
      <div
        className={cn(
          scoreReport.headerNavy,
          "flex items-center justify-between",
          isCompact ? "px-4 py-2.5" : "px-5 py-3"
        )}
      >
        <span className={cn("font-bold tracking-tight", isCompact ? "text-lg" : "text-xl")}>
          SAT
        </span>
        {!modulePreview && !isCompact ? (
          <button
            type="button"
            disabled
            aria-disabled
            title="Download coming soon"
            className="rounded p-1 text-white/60 cursor-not-allowed"
          >
            <Download className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          scoreReport.subBarBlue,
          "flex items-center justify-between gap-3 font-semibold",
          isCompact ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm"
        )}
      >
        <span className="truncate uppercase tracking-wide">
          {modulePreview?.label ?? filename ?? "Practice Test"}
        </span>
        {formattedDate && !modulePreview ? (
          <span className="shrink-0 tabular-nums">{formattedDate}</span>
        ) : null}
        {modulePreview && headerSubtitle ? (
          <span className="shrink-0 text-white/90 text-xs font-normal">{headerSubtitle}</span>
        ) : null}
      </div>

      {headerSubtitle && !modulePreview ? (
        <div className={cn(scoreReport.subBarBlue, "border-t border-white/10 px-5 py-1.5 text-xs font-medium")}>
          {headerSubtitle}
        </div>
      ) : null}

      <div className={cn(scoreReport.totalBand, "text-center", isCompact ? "px-4 py-5" : "px-6 py-8")}>
        <p className={scoreReport.labelMuted}>{bandTitle}</p>
        <p
          className={cn(
            scoreReport.scoreNumber,
            "mt-2",
            isCompact ? "text-4xl" : "text-5xl sm:text-6xl"
          )}
        >
          {displayScore}
        </p>
        {modulePreview ? (
          <p className="mt-1 text-sm text-[#6b7280] tabular-nums">{modulePreview.percentage}%</p>
        ) : (
          <p className="mt-2">
            <ScoreRange min={rangeMin} max={scoreMax} />
          </p>
        )}
      </div>

      {!modulePreview && isFull && showRw ? (
        <SectionRow
          label="Reading and Writing"
          score={sat.rwScaled}
          rangeMin={200}
          rangeMax={800}
          compact={isCompact}
        />
      ) : null}

      {!modulePreview && isFull && showMath ? (
        <SectionRow
          label="Math"
          score={sat.mathScaled}
          rangeMin={200}
          rangeMax={800}
          compact={isCompact}
        />
      ) : null}

      {!modulePreview && !isCompact ? (
        <div className={cn(scoreReport.sectionDivider, "px-6 py-3")}>
          <p className={scoreReport.disclaimer}>
            Scaled scores are an approximation. Actual SAT scores depend on adaptive routing and
            statistical equating.
          </p>
        </div>
      ) : null}
    </div>
  );
}
