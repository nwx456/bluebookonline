"use client";

import Link from "next/link";

type ConsentModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ConsentModal({
  open,
  title,
  children,
  confirmLabel = "I agree",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}: ConsentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h2 id="consent-modal-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="mt-3 text-sm text-gray-600 leading-relaxed">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : confirmLabel}
          </button>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          See our{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link href="/terms#source-attestation-and-copyright-compliance" className="text-blue-600 hover:underline">
            upload rules
          </Link>
          , and{" "}
          <Link href="/copyright" className="text-blue-600 hover:underline">
            Copyright Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
