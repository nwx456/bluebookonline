"use client";

import { useEffect, useState } from "react";
import PdfPageView from "./PdfPageView";
import ZoomableImagePanel from "./ZoomableImagePanel";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);

  useEffect(() => {
    if (open) setCurrentPage(pageNumber);
  }, [open, pageNumber]);

  useEffect(() => {
    if (!open || !pdfUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        setNumPages(doc.numPages);
      } catch {
        setNumPages(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open || !numPages) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPage((p) => Math.min(numPages, p + 1));
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, numPages]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const canPrev = currentPage > 1;
  const canNext = numPages != null && currentPage < numPages;

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
            <PdfPageView pdfUrl={pdfUrl} pageNumber={currentPage} bbox={null} />
          </ZoomableImagePanel>
        </div>
        {numPages != null && numPages > 1 && (
          <div className="flex items-center justify-center gap-4 border-t border-gray-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {numPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={!canNext}
              className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
