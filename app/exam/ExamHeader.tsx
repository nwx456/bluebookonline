"use client";

import { ChevronDown, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface ExamHeaderProps {
  headerTitle: string;
  directionsOpen: boolean;
  onToggleDirections: () => void;
  directionsContent: React.ReactNode;
  timerVisible: boolean;
  timerPaused: boolean;
  elapsedSeconds: number;
  onToggleTimerPause: () => void;
  onHideTimer: () => void;
  onShowTimer: () => void;
  toolbar: React.ReactNode;
  subBanner?: React.ReactNode;
}

export function ExamHeader({
  headerTitle,
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
  subBanner,
}: ExamHeaderProps) {
  return (
    <header
      className={cn(
        "flex-shrink-0 text-gray-900",
        examUi.headerBg,
        examUi.chromeBorderBottom
      )}
    >
      <div className="relative flex items-center justify-between px-4 py-3">
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
              <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded border border-gray-200 bg-white p-3 text-left text-sm text-gray-800 shadow-lg">
                {directionsContent}
              </div>
            )}
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          {timerVisible ? (
            <div className="text-center">
              <div className="flex flex-row items-center justify-center gap-2">
                <p className="text-lg font-mono tabular-nums text-gray-900">
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
              <button
                type="button"
                onClick={onHideTimer}
                className={cn("mt-1", examUi.hideTimerPill)}
              >
                Hide
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onShowTimer}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Show timer
            </button>
          )}
        </div>

        <div className="relative flex min-w-0 flex-1 items-center justify-end gap-2">{toolbar}</div>
      </div>
      {subBanner}
    </header>
  );
}
