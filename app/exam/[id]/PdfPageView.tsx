"use client";

import { useState, useEffect, useRef } from "react";
import { cropCanvasToDataUrl } from "@/lib/pdf-crop";
import { prepareCropRect } from "@/lib/pdf-geometry";

/** Bbox: pixel coordinates (x, y = top-left) or 0-1 normalized (legacy). */
export type PdfBbox = { x: number; y: number; width: number; height: number };

/**
 * Renders a single PDF page or a cropped region of it as a high-resolution
 * data URL. The bbox is expanded with a safety margin and falls back to the
 * full page when the AI-supplied region is implausibly small.
 */
export default function PdfPageView({
  pdfUrl,
  pageNumber,
  bbox,
  onRendered,
  className,
}: {
  pdfUrl: string;
  pageNumber: number;
  bbox?: PdfBbox | null;
  onRendered?: (dataUrl: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [cropDataUrl, setCropDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl || pageNumber < 1) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAspectRatio(null);
    setCropDataUrl(null);
    (async () => {
      try {
        const scale = 3;
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const fullWidth = viewport.width;
        const fullHeight = viewport.height;

        const offScreen = document.createElement("canvas");
        offScreen.width = fullWidth;
        offScreen.height = fullHeight;
        const offCtx = offScreen.getContext("2d");
        if (!offCtx) return;
        await page.render({
          canvas: offScreen,
          canvasContext: offCtx,
          viewport,
        }).promise;
        if (cancelled) return;

        let usedRect: { x: number; y: number; width: number; height: number } | null = null;
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const prepared = prepareCropRect(bbox, fullWidth, fullHeight);
          usedRect = prepared.rect;
        }

        if (usedRect && usedRect.width > 0 && usedRect.height > 0) {
          const dataUrl = cropCanvasToDataUrl(offScreen, usedRect, "image/png");
          if (cancelled) return;
          if (dataUrl) {
            const aspect = usedRect.width / usedRect.height;
            setAspectRatio(aspect);
            setCropDataUrl(dataUrl);
            onRendered?.(dataUrl);
          } else {
            canvas.width = fullWidth;
            canvas.height = fullHeight;
            ctx.drawImage(offScreen, 0, 0);
            if (!cancelled) setAspectRatio(fullWidth / fullHeight);
          }
        } else {
          canvas.width = fullWidth;
          canvas.height = fullHeight;
          ctx.drawImage(offScreen, 0, 0);
          if (!cancelled) setAspectRatio(fullWidth / fullHeight);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber, bbox, onRendered]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const showCanvas = !loading && !cropDataUrl;
  const showImg = !loading && cropDataUrl;

  return (
    <div
      className={className}
      style={{
        maxWidth: "100%",
        aspectRatio: aspectRatio ?? 1,
        width: "100%",
        position: "relative",
      }}
    >
      {loading && (
        <p className="text-sm text-gray-500 absolute inset-0 flex items-center justify-center bg-white/80">
          Loading PDF page…
        </p>
      )}
      <canvas
        ref={canvasRef}
        style={
          showCanvas
            ? { width: "100%", height: "100%", display: "block" }
            : { position: "absolute", left: -9999, width: 1, height: 1, visibility: "hidden" as const }
        }
      />
      {showImg && cropDataUrl && (
        <img
          src={cropDataUrl}
          alt="Graph"
          className="max-w-full h-auto block object-contain w-full"
        />
      )}
    </div>
  );
}
