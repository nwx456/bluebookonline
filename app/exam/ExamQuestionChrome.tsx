"use client";

import { useId } from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";

export interface ExamQuestionChromeProps {
  displayQuestionNumber: number;
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-base font-bold",
          examUi.questionBadge
        )}
      >
        {displayQuestionNumber}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-gray-100 px-3 py-2.5">
        <input
          id={markId}
          type="checkbox"
          checked={markedForReview}
          onChange={onToggleMarkForReview}
          className="h-5 w-5 shrink-0 cursor-pointer rounded-sm border-2 border-gray-700 accent-gray-900"
        />
        <label
          htmlFor={markId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-base text-gray-900"
        >
          <Flag
            className={cn(
              "h-5 w-5 shrink-0",
              markedForReview ? "fill-gray-900 text-gray-900" : "text-gray-700"
            )}
            aria-hidden
          />
          <span>Mark for Review</span>
        </label>
        {showAbcDecor ? (
          <div
            className={cn("ml-2 shrink-0", examUi.abcToolDecor)}
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
