"use client";

import { FileDown } from "lucide-react";

export function BlogSavePdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label="Save this article as PDF using the print dialog"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 print:hidden"
    >
      <FileDown className="h-4 w-4" aria-hidden />
      Save as PDF
    </button>
  );
}
