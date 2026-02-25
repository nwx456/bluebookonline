"use client";

import { useEffect } from "react";
import PdfPageView from "./PdfPageView";
import ZoomableImagePanel from "./ZoomableImagePanel";

export default function FullPageModal({
  open,
  onClose,
  pdfUrl,
  pageNumber,
}: {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  pageNumber: number;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Tam sayfa görünümü"
    >
      <div
        className="relative flex max-h-full w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-600 shadow-md hover:bg-gray-100"
          aria-label="Kapat"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1 overflow-hidden p-4 pt-12">
          <ZoomableImagePanel className="max-h-[85vh]">
            <PdfPageView pdfUrl={pdfUrl} pageNumber={pageNumber} bbox={null} />
          </ZoomableImagePanel>
        </div>
      </div>
    </div>
  );
}
