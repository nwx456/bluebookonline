"use client";

import { Printer } from "lucide-react";

export function LegalPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Print / Save PDF
    </button>
  );
}
