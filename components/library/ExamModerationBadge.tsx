"use client";

import type { ExamPublishState } from "@/lib/exam-publish-utils";
import {
  getModerationStatusBadgeClass,
  getModerationStatusLabel,
} from "@/lib/exam-publish-utils";
import { cn } from "@/lib/utils";

interface ExamModerationBadgeProps {
  exam: ExamPublishState;
  className?: string;
}

export function ExamModerationBadge({ exam, className }: ExamModerationBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        getModerationStatusBadgeClass(exam),
        className
      )}
    >
      {getModerationStatusLabel(exam)}
    </span>
  );
}
