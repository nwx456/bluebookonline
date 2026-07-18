"use client";

import { useEffect, useId, useState } from "react";
import { QUESTION_REPORT_REASONS } from "@/lib/question-report-reasons";
import { cn } from "@/lib/utils";

type QuestionReportModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { reasonCodes: string[]; customNote: string }) => void;
  error?: string | null;
};

export function QuestionReportModal({
  open,
  onClose,
  onSubmit,
  error,
}: QuestionReportModalProps) {
  const titleId = useId();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setCustomNote("");
    }
  }, [open]);

  if (!open) return null;

  const toggleReason = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit({
      reasonCodes: [...selected],
      customNote: customNote.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          Report a problem with this question
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Select all issues that apply. Your exam timer will keep running.
        </p>

        <ul className="mt-4 space-y-2">
          {QUESTION_REPORT_REASONS.map(({ code, label }) => {
            const checked = selected.has(code);
            const inputId = `report-reason-${code}`;
            return (
              <li key={code}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                    checked
                      ? "border-red-200 bg-red-50 text-gray-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReason(code)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-red-600"
                  />
                  <span>{label}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-4">
          <label htmlFor="report-custom-note" className="block text-sm font-medium text-gray-700">
            Additional details (optional)
          </label>
          <textarea
            id="report-custom-note"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Describe the issue briefly…"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.size === 0}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}
