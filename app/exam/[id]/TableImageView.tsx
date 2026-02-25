"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TABLE_WRAPPER_CLASS =
  "overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5";

/**
 * Renders table HTML, captures it with html2canvas, and calls onRendered(dataUrl).
 * Parent should then save via save-table API and update questionIdToImageUrl.
 */
export default function TableImageView({
  tableHtml,
  onRendered,
  className,
}: {
  tableHtml: string;
  onRendered?: (dataUrl: string) => void;
  className?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [captured, setCaptured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableHtml?.trim() || !divRef.current || captured || error) return;
    let cancelled = false;
    const el = divRef.current;

    const capture = () => {
      if (cancelled || !el) return;
      import("html2canvas").then(({ default: html2canvas }) => {
        if (cancelled) return;
        html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        })
        .then((canvas) => {
          if (cancelled) return;
          const dataUrl = canvas.toDataURL("image/png");
          setCaptured(true);
          onRendered?.(dataUrl);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Capture failed");
          }
        });
      });
    };

    const id = setTimeout(capture, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [tableHtml, onRendered, captured, error]);

  if (error) {
    return (
      <div
        className={cn(TABLE_WRAPPER_CLASS, "bg-white", className)}
        style={{ minWidth: 200 }}
        dangerouslySetInnerHTML={{ __html: tableHtml }}
      />
    );
  }

  return (
    <div
      ref={divRef}
      className={cn(TABLE_WRAPPER_CLASS, "bg-white", className)}
      style={{ minWidth: 200 }}
      dangerouslySetInnerHTML={{ __html: tableHtml }}
    />
  );
}
