"use client";

import { useState, useEffect, useRef } from "react";

/** Renders a single PDF page to canvas (Macro/Micro graph from PDF). Client-only. */
export default function PdfPageView({
  pdfUrl,
  pageNumber,
  className,
}: {
  pdfUrl: string;
  pageNumber: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfUrl || pageNumber < 1) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (loading) return <p className="text-sm text-gray-500">Loading PDF page…</p>;
  return <canvas ref={canvasRef} className={className} />;
}
