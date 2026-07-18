"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  getActivePhaseHint,
  type AnalyzeErrorDisplay,
  type AnalyzePhase,
  type PhaseStatus,
} from "@/lib/upload-analyze-progress";

export interface PhaseTiming {
  startedAt?: number;
  durationMs?: number;
  detail?: string;
  status: PhaseStatus;
  errorMessage?: string;
}

export interface UploadAnalyzeProgressProps {
  phases: AnalyzePhase[];
  phaseTimings: Record<string, PhaseTiming>;
  activePhaseId: string | null;
  overallStartedAt: number | null;
  totalPredictedLabel?: string;
  error: AnalyzeErrorDisplay | null;
  headline?: string;
  subtitle?: string;
  showPhaseList?: boolean;
  className?: string;
  onDismiss?: () => void;
  onTryAgain?: () => void;
}

function useLiveElapsed(startedAt: number | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, now - startedAt);
}

export function UploadAnalyzeProgress({
  phases,
  phaseTimings,
  activePhaseId,
  overallStartedAt,
  totalPredictedLabel,
  error,
  headline = "Analyzing your PDF…",
  subtitle,
  showPhaseList = true,
  className,
  onDismiss,
  onTryAgain,
}: UploadAnalyzeProgressProps) {
  const overallElapsed = useLiveElapsed(overallStartedAt);
  const activePhase = phases.find((p) => p.id === activePhaseId);

  const doneCount = useMemo(
    () => phases.filter((p) => phaseTimings[p.id]?.status === "done").length,
    [phases, phaseTimings]
  );
  const progressPct =
    phases.length > 0 ? Math.round((doneCount / phases.length) * 100) : 0;

  return (
    <div
      className={cn(
        "mt-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-100/50",
        className
      )}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50/80 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-900">{error.title}</p>
              <p className="mt-1 text-sm text-red-800">{error.message}</p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-medium text-gray-900">What happened: </span>
                {error.reason}
              </p>
              <p className="mt-2 text-sm text-gray-700">
                <span className="font-medium text-gray-900">What you can do: </span>
                {error.suggestion}
              </p>
              {error.modeMismatchWarning ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {error.modeMismatchWarning}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {onTryAgain ? (
                  <button
                    type="button"
                    onClick={onTryAgain}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Try again
                  </button>
                ) : null}
                {onDismiss ? (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Dismiss
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="font-medium text-gray-900">
            {error ? "Analysis stopped" : headline}
          </span>
          {subtitle && !error ? (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>
          ) : null}
        </div>
        <span className="text-gray-500 tabular-nums shrink-0">
          {overallStartedAt != null ? formatDuration(overallElapsed) : "—"}
          {totalPredictedLabel ? ` · ${totalPredictedLabel}` : ""}
        </span>
      </div>

      <div className="mb-4 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500",
            error ? "bg-red-400" : "bg-blue-600"
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {!error && activePhase ? (
        <p className="mb-3 text-xs text-gray-500">{getActivePhaseHint(activePhase)}</p>
      ) : null}

      {showPhaseList ? (
        <ul className="space-y-1">
          {phases.map((phase) => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              timing={phaseTimings[phase.id]}
              isActive={activePhaseId === phase.id}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PhaseRow({
  phase,
  timing,
  isActive,
}: {
  phase: AnalyzePhase;
  timing?: PhaseTiming;
  isActive: boolean;
}) {
  const status = timing?.status ?? "pending";
  const liveElapsed = useLiveElapsed(
    status === "active" ? timing?.startedAt ?? null : null
  );

  const Icon =
    status === "done"
      ? CheckCircle2
      : status === "error"
        ? XCircle
        : status === "active"
          ? Loader2
          : Circle;

  const iconClass =
    status === "done"
      ? "text-green-600"
      : status === "error"
        ? "text-red-600"
        : status === "active"
          ? "text-blue-600 animate-spin"
          : "text-gray-300";

  const rightLabel =
    status === "done" && timing?.durationMs != null
      ? timing.detail
        ? `${formatDuration(timing.durationMs)} · ${timing.detail}`
        : formatDuration(timing.durationMs)
      : status === "active"
        ? formatDuration(liveElapsed)
        : null;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg px-2 py-2 text-sm",
        isActive && status === "active" && "bg-blue-50",
        status === "error" && "bg-red-50/60"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", iconClass)} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-medium truncate",
            status === "pending" ? "text-gray-400" : "text-gray-900"
          )}
        >
          {phase.label}
        </p>
        {status === "error" && timing?.errorMessage ? (
          <p className="text-xs text-red-700 mt-0.5 line-clamp-2">{timing.errorMessage}</p>
        ) : null}
      </div>
      {rightLabel ? (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            status === "active" ? "text-blue-600" : "text-gray-400"
          )}
        >
          {rightLabel}
        </span>
      ) : null}
    </li>
  );
}
