"use client";

import { ArrowLeftRight, ListChecks, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadExamKind = "mcq" | "frq";

type Props = {
  onSelect: (kind: UploadExamKind) => void;
};

export function ExamTypeChooser({ onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Upload exam</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose the type of exam you want to upload and practice.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("mcq")}
          className={cn(
            "rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-colors",
            "hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <ListChecks className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Multiple Choice (MCQ)</h2>
          <p className="mt-2 text-sm text-gray-600">
            Upload AP PDFs. AI extracts multiple-choice questions for Bluebook-style practice.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelect("frq")}
          className={cn(
            "rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-colors",
            "hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <PenLine className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Free Response (FRQ)</h2>
          <p className="mt-2 text-sm text-gray-600">
            Upload AP Free Response exams for 16 fully digital Bluebook courses. Type answers in a
            split-screen exam with AI rubric grading.
          </p>
        </button>
      </div>
    </div>
  );
}

export function UploadKindHeader({
  kind,
  onChangeType,
  showChangeType = true,
}: {
  kind: UploadExamKind;
  onChangeType: () => void;
  showChangeType?: boolean;
}) {
  const isMcq = kind === "mcq";
  const badge = isMcq ? "MCQ" : "FRQ";
  const label = isMcq ? "Multiple Choice" : "Free Response";
  const description = isMcq
    ? "Upload AP or SAT multiple-choice PDFs"
    : "Upload AP Free Response PDFs for digital Bluebook practice";

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-[#f2f5f9] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        "shadow-sm"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-bold tracking-wide",
            isMcq ? "bg-blue-600 text-white" : "bg-indigo-600 text-white"
          )}
        >
          {badge}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="truncate text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {showChangeType ? (
        <button
          type="button"
          onClick={onChangeType}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5",
            "text-sm font-medium text-gray-800 shadow-sm transition-colors",
            "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          )}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Change exam type
        </button>
      ) : null}
    </div>
  );
}

export function parseUploadExamKind(value: string | null): UploadExamKind | null {
  if (value === "mcq" || value === "frq") return value;
  return null;
}
