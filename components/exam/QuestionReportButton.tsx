"use client";

import { Flag } from "lucide-react";
import {
  examToolbarBtn,
  examToolbarBtnReport,
} from "@/app/exam/exam-ui-tokens";
import { cn } from "@/lib/utils";

type QuestionReportButtonProps = {
  onClick: () => void;
  className?: string;
};

export function QuestionReportButton({ onClick, className }: QuestionReportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(examToolbarBtn, examToolbarBtnReport, className)}
      aria-label="Report a problem with this question"
    >
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Report
    </button>
  );
}
