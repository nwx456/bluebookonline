"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TABLE_WRAPPER_CLASS =
  "overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5";

/**
 * Renders sanitized table HTML (always visible, scrollable) and tries to
 * capture it as a high-resolution PNG in the background. Capture failures are
 * silent — the user always sees the readable HTML version.
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

  useEffect(() => {
    if (!tableHtml?.trim() || !divRef.current || captured) return;
    let cancelled = false;
    const el = divRef.current;

    const capture = async () => {
      if (cancelled || !el) return;
      try {
        const { default: html2canvas } = await import("html2canvas");
        if (cancelled) return;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        if (cancelled) return;

        const scrollW = Math.max(el.scrollWidth, el.offsetWidth);
        const scrollH = Math.max(el.scrollHeight, el.offsetHeight);
        if (scrollW <= 0 || scrollH <= 0) return;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const scale = Math.min(3, Math.max(2, dpr));

        const canvas = await html2canvas(el, {
          scale,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: scrollW,
          height: scrollH,
          windowWidth: scrollW,
          windowHeight: scrollH,
        });
        if (cancelled) return;

        const dataUrl = canvas.toDataURL("image/png");
        setCaptured(true);
        onRendered?.(dataUrl);
      } catch {
        // Silent — HTML view is always rendered.
      }
    };

    const id = setTimeout(capture, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [tableHtml, onRendered, captured]);

  return (
    <div
      ref={divRef}
      className={cn(TABLE_WRAPPER_CLASS, "bg-white", className)}
      style={{ minWidth: 200 }}
      dangerouslySetInnerHTML={{ __html: tableHtml }}
    />
  );
}
