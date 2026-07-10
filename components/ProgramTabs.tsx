"use client";

import { cn } from "@/lib/utils";
import type { ExamProgram } from "@/lib/exam-program";

interface ProgramTabsProps {
  program: ExamProgram;
  onChange: (program: ExamProgram) => void;
  className?: string;
}

/**
 * Pill-style AP/SAT toggle used on the homepage top bar. Switches between
 * AP-only and SAT-only views (subject grid, hero copy, FAQ, published list).
 */
export function ProgramTabs({ program, onChange, className }: ProgramTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Choose exam program"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 text-sm shadow-sm min-w-[7.25rem] max-sm:min-w-0 max-sm:w-full max-sm:justify-center",
        className
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={program === "AP"}
        onClick={() => onChange("AP")}
        className={cn(
          "min-w-[2.75rem] rounded-full px-4 py-1.5 text-center font-medium transition-colors",
          program === "AP"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        )}
      >
        AP
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={program === "SAT"}
        onClick={() => onChange("SAT")}
        className={cn(
          "min-w-[2.75rem] rounded-full px-4 py-1.5 text-center font-medium transition-colors",
          program === "SAT"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        )}
      >
        SAT
      </button>
    </div>
  );
}
