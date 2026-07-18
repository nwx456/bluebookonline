"use client";

import { UNPUBLISH_CONFIRM_COOLDOWN_SEC } from "@/lib/exam-publish-utils";
import { cn } from "@/lib/utils";

interface UnpublishExamModalProps {
  open: boolean;
  title: string;
  busy?: boolean;
  cooldownSec?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnpublishExamModal({
  open,
  title,
  busy,
  cooldownSec = UNPUBLISH_CONFIRM_COOLDOWN_SEC,
  onConfirm,
  onCancel,
}: UnpublishExamModalProps) {
  if (!open) return null;

  const disabled = busy || cooldownSec > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unpublish-dialog-title"
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="unpublish-dialog-title" className="text-lg font-semibold text-gray-900">
          Unpublish &quot;{title}&quot;?
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Published exams help everyone practice. We recommend keeping yours published.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium text-white",
              disabled ? "bg-amber-700/50 cursor-not-allowed" : "bg-amber-700 hover:bg-amber-800"
            )}
          >
            {cooldownSec > 0 ? `Unpublish anyway (${cooldownSec})` : "Unpublish anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}
