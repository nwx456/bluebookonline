"use client";

import { cn } from "@/lib/utils";
import { frqPassageProseClass } from "@/lib/frq-display";
import {
  getTableHtmlForPanel,
  sanitizeTableHtml,
  TABLE_FALLBACK_CLASS,
  type FrqLeftPanelMode,
} from "@/lib/exam-left-panel-utils";
import TableImageView from "@/app/exam/[id]/TableImageView";
import PdfPageView from "@/app/exam/[id]/PdfPageView";
import ZoomableImagePanel from "@/app/exam/[id]/ZoomableImagePanel";

interface FrqLeftPanelContentProps {
  mode: FrqLeftPanelMode;
  content: string;
  pdfUrl?: string | null;
  pageNumber?: number | null;
  questionKey: string;
}

export function FrqLeftPanelContent({
  mode,
  content,
  pdfUrl,
  pageNumber,
  questionKey,
}: FrqLeftPanelContentProps) {
  if (mode === "none") return null;

  if (mode === "table") {
    const tableHtml = getTableHtmlForPanel(content);
    return (
      <ZoomableImagePanel key={questionKey} className="max-w-full">
        {tableHtml.trim() ? (
          <TableImageView tableHtml={tableHtml} className="overflow-auto max-w-full" />
        ) : (
          <div
            className={cn(TABLE_FALLBACK_CLASS, "bg-white overflow-auto max-w-full")}
            style={{ minWidth: 200 }}
            dangerouslySetInnerHTML={{ __html: sanitizeTableHtml(content) }}
          />
        )}
      </ZoomableImagePanel>
    );
  }

  if (mode === "graph") {
    if (pdfUrl && pageNumber && pageNumber >= 1) {
      return (
        <ZoomableImagePanel key={questionKey} className="max-w-full">
          <PdfPageView pdfUrl={pdfUrl} pageNumber={pageNumber} bbox={null} className="max-w-full" />
        </ZoomableImagePanel>
      );
    }
    return (
      <div className={frqPassageProseClass} dangerouslySetInnerHTML={{ __html: content }} />
    );
  }

  return (
    <div className={frqPassageProseClass} dangerouslySetInnerHTML={{ __html: content }} />
  );
}
