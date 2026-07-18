"use client";

import { useState } from "react";
import { ChevronDown, MoreHorizontal, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TimerBlock({
  timerVisible,
  timerPaused,
  elapsedSeconds,
  onToggleTimerPause,
  onHideTimer,
  onShowTimer,
  timerUrgent,
  compact = false,
}: {
  timerVisible: boolean;
  timerPaused: boolean;
  elapsedSeconds: number;
  onToggleTimerPause: () => void;
  onHideTimer: () => void;
  onShowTimer: () => void;
  timerUrgent: boolean;
  compact?: boolean;
}) {
  if (!timerVisible) {
    return (
      <button
        type="button"
        onClick={onShowTimer}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Show timer
      </button>
    );
  }

  return (
    <div className="text-center">
      <div className="flex flex-row items-center justify-center gap-2">
        <p
          className={cn(
            "font-mono tabular-nums",
            compact ? "text-base" : "text-lg",
            timerUrgent ? "font-bold text-red-600" : "text-gray-900"
          )}
        >
          {formatTimer(elapsedSeconds)}
        </p>
        <button
          type="button"
          onClick={onToggleTimerPause}
          className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
          title={timerPaused ? "Resume timer" : "Pause timer"}
          aria-label={timerPaused ? "Resume timer" : "Pause timer"}
        >
          {timerPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>
      {!compact ? (
        <button type="button" onClick={onHideTimer} className={cn("mt-1", examUi.hideTimerPill)}>
          Hide
        </button>
      ) : (
        <button
          type="button"
          onClick={onHideTimer}
          className="mt-0.5 text-xs text-gray-600 hover:text-gray-900"
        >
          Hide
        </button>
      )}
    </div>
  );
}

export interface ExamHeaderProps {
  headerTitle: string;
  /** Shorter title for mobile (< md). Falls back to headerTitle. */
  headerTitleShort?: string;
  directionsOpen: boolean;
  onToggleDirections: () => void;
  directionsContent: React.ReactNode;
  timerVisible: boolean;
  timerPaused: boolean;
  elapsedSeconds: number;
  onToggleTimerPause: () => void;
  onHideTimer: () => void;
  onShowTimer: () => void;
  /** Full toolbar for desktop (md+). */
  toolbar: React.ReactNode;
  /** Primary mobile toolbar row (e.g. Save & exit). */
  toolbarPrimary?: React.ReactNode;
  /** Overflow items shown in More menu on mobile. */
  toolbarOverflow?: React.ReactNode;
  subBanner?: React.ReactNode;
  /** When true, timer digits render in urgent red (e.g. FRQ countdown under 5 min). */
  timerUrgent?: boolean;
}

export function ExamHeader({
  headerTitle,
  headerTitleShort,
  directionsOpen,
  onToggleDirections,
  directionsContent,
  timerVisible,
  timerPaused,
  elapsedSeconds,
  onToggleTimerPause,
  onHideTimer,
  onShowTimer,
  toolbar,
  toolbarPrimary,
  toolbarOverflow,
  subBanner,
  timerUrgent = false,
}: ExamHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileTitle = headerTitleShort ?? headerTitle;
  const useMobileSplit = Boolean(toolbarPrimary ?? toolbarOverflow);

  return (
    <header
      className={cn(
        "flex-shrink-0 text-gray-900",
        examUi.headerBg,
        examUi.chromeBorderBottom
      )}
    >
      {/* Mobile layout (< md) */}
      {useMobileSplit ? (
        <div className="md:hidden">
          <div className="flex items-start justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{mobileTitle}</p>
              <div className="relative mt-0.5">
                <button
                  type="button"
                  onClick={onToggleDirections}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  Directions <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {directionsOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded border border-gray-200 bg-white p-3 text-left text-sm text-gray-800 shadow-lg">
                    {directionsContent}
                  </div>
                )}
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className={cn(examUi.mobileToolbarBtn, "border-gray-300 bg-white text-gray-700")}
                aria-label="More tools"
                aria-expanded={moreOpen}
              >
                {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
              </button>
              {moreOpen && toolbarOverflow ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-black/20"
                    aria-label="Close menu"
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    <div
                      className="flex flex-col gap-1"
                      onClick={() => setMoreOpen(false)}
                    >
                      {toolbarOverflow}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#e2e8f0] px-3 py-2">
            <div className="flex flex-1 justify-center">
              <TimerBlock
                timerVisible={timerVisible}
                timerPaused={timerPaused}
                elapsedSeconds={elapsedSeconds}
                onToggleTimerPause={onToggleTimerPause}
                onHideTimer={onHideTimer}
                onShowTimer={onShowTimer}
                timerUrgent={timerUrgent}
                compact
              />
            </div>
            {toolbarPrimary ? (
              <div className="flex shrink-0 items-center">{toolbarPrimary}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Desktop layout (md+) or fallback when no mobile split */}
      <div
        className={cn(
          "relative flex items-center justify-between px-4 py-3",
          useMobileSplit ? "hidden md:flex" : "flex"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-gray-900 sm:text-lg">{headerTitle}</p>
          <div className="relative mt-0.5">
            <button
              type="button"
              onClick={onToggleDirections}
              className="flex items-center gap-1 text-base text-gray-600 hover:text-gray-900"
            >
              Directions <ChevronDown className="h-4 w-4" />
            </button>
            {directionsOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded border border-gray-200 bg-white p-3 text-left text-sm text-gray-800 shadow-lg">
                {directionsContent}
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <TimerBlock
            timerVisible={timerVisible}
            timerPaused={timerPaused}
            elapsedSeconds={elapsedSeconds}
            onToggleTimerPause={onToggleTimerPause}
            onHideTimer={onHideTimer}
            onShowTimer={onShowTimer}
            timerUrgent={timerUrgent}
          />
        </div>

        <div className="relative flex min-w-0 flex-1 items-center justify-end gap-2">{toolbar}</div>
      </div>
      {subBanner}
    </header>
  );
}
