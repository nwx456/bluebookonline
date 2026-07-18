"use client";

import { ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";

export interface ExamFooterProps {
  displayUsername: string;
  centerContent: React.ReactNode;
  actions: React.ReactNode;
}

export function ExamFooter({ displayUsername, centerContent, actions }: ExamFooterProps) {
  return (
    <footer
      className={cn(
        "flex-shrink-0 px-3 py-2 text-gray-900 sm:px-4 sm:py-3",
        examUi.footerBg,
        examUi.chromeBorderTop,
        examUi.safeAreaBottom
      )}
    >
      {/* Mobile: stacked layout */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center justify-center">{centerContent}</div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {/* Desktop: 3-column row */}
      <div className="hidden items-center justify-between gap-4 sm:flex">
        <p className="min-w-0 truncate text-base text-gray-800">{displayUsername}</p>
        <div className="flex shrink-0 items-center justify-center">{centerContent}</div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </footer>
  );
}

export interface ExamFooterQuestionNavProps {
  currentIndex: number;
  totalQuestions: number;
  questionListOpen: boolean;
  onToggleQuestionList: () => void;
  onCloseQuestionList?: () => void;
  questionGrid: React.ReactNode;
}

export function ExamFooterQuestionNav({
  currentIndex,
  totalQuestions,
  questionListOpen,
  onToggleQuestionList,
  onCloseQuestionList,
  questionGrid,
}: ExamFooterQuestionNavProps) {
  const close = onCloseQuestionList ?? (() => onToggleQuestionList());

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleQuestionList}
        className={cn("flex items-center gap-2", examUi.footerNavPill)}
      >
        <span className="sm:hidden">
          Q {currentIndex + 1}/{totalQuestions}
        </span>
        <span className="hidden sm:inline">
          Question {currentIndex + 1} of {totalQuestions}
        </span>
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Desktop: popup above button */}
      {questionListOpen ? (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 hidden min-w-[18rem] max-h-56 max-w-[22rem] -translate-x-1/2 overflow-auto rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-800 shadow-xl sm:block">
          <p className="px-1 pb-2 text-xs font-semibold text-gray-500">Questions</p>
          {questionGrid}
        </div>
      ) : null}

      {/* Mobile: bottom sheet */}
      {questionListOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            aria-label="Close question list"
            onClick={close}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-auto rounded-t-xl border border-gray-300 bg-white px-4 py-4 text-gray-800 shadow-xl safe-area-bottom sm:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Questions</p>
              <button
                type="button"
                onClick={close}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {questionGrid}
          </div>
        </>
      ) : null}
    </div>
  );
}
