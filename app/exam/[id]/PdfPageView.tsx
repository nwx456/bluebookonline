"use client";

import { useState, useEffect, useRef } from "react";

/** Renders a single PDF page to canvas (Macro/Micro graph from PDF). Client-only. Preserves aspect ratio so slopes and appearance match the PDF. */
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
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!pdfUrl || pageNumber < 1) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAspectRatio(null);
    (async () => {
      try {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const baseScale = 2;
        const scale = baseScale * dpr;
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        if (!cancelled) setAspectRatio(viewport.width / viewport.height);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({
          canvas,
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
  return (
    <div
      className={className}
      style={{
        maxWidth: "100%",
        aspectRatio: aspectRatio ?? 1,
        width: "100%",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
