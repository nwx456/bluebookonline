"use client";

import { useId } from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";

export interface ExamQuestionChromeProps {
  displayQuestionNumber: number | string;
  markedForReview: boolean;
  onToggleMarkForReview: () => void;
  showAbcDecor?: boolean;
}

export function ExamQuestionChrome({
  displayQuestionNumber,
  markedForReview,
  onToggleMarkForReview,
  showAbcDecor = true,
}: ExamQuestionChromeProps) {
  const markId = useId();

  return (
    <div className="flex items-stretch gap-2">
      <div
        className={cn(
          "flex h-9 shrink-0 items-center justify-center rounded-sm font-bold",
          typeof displayQuestionNumber === "string" && displayQuestionNumber.length > 1
            ? "min-w-9 px-1.5 text-sm"
            : "w-9 text-base",
          examUi.questionBadge
        )}
      >
        {displayQuestionNumber}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-gray-100 px-2 py-2 sm:px-3 sm:py-2.5">
        <input
          id={markId}
          type="checkbox"
          checked={markedForReview}
          onChange={onToggleMarkForReview}
          className="h-5 w-5 shrink-0 cursor-pointer rounded-sm border-2 border-gray-700 accent-gray-900"
        />
        <label
          htmlFor={markId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-gray-900 sm:text-base"
        >
          <Flag
            className={cn(
              "h-5 w-5 shrink-0",
              markedForReview ? "fill-gray-900 text-gray-900" : "text-gray-700"
            )}
            aria-hidden
          />
          <span className="hidden sm:inline">Mark for Review</span>
          <span className="sm:hidden">Review</span>
        </label>
        {showAbcDecor ? (
          <div
            className={cn("ml-1 hidden shrink-0 sm:ml-2 sm:flex", examUi.abcToolDecor)}
            title="Cross out answer choices using the letter buttons on the right of each option"
            aria-hidden
          >
            <span className="line-through decoration-white decoration-2">ABC</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
