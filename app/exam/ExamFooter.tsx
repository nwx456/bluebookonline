"use client";

import { ChevronUp } from "lucide-react";
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
        "flex-shrink-0 px-4 py-3 text-gray-900",
        examUi.footerBg,
        examUi.chromeBorderTop
      )}
    >
      <div className="flex items-center justify-between gap-4">
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
  questionGrid: React.ReactNode;
}

export function ExamFooterQuestionNav({
  currentIndex,
  totalQuestions,
  questionListOpen,
  onToggleQuestionList,
  questionGrid,
}: ExamFooterQuestionNavProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleQuestionList}
        className={cn("flex items-center gap-2", examUi.footerNavPill)}
      >
        Question {currentIndex + 1} of {totalQuestions}
        <ChevronUp className="h-4 w-4" />
      </button>
      {questionListOpen && (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 min-w-[18rem] max-w-[22rem] max-h-56 -translate-x-1/2 overflow-auto rounded-lg border border-gray-300 bg-white px-3 py-3 text-gray-800 shadow-xl">
          <p className="px-1 pb-2 text-xs font-semibold text-gray-500">Questions</p>
          {questionGrid}
        </div>
      )}
    </div>
  );
}
