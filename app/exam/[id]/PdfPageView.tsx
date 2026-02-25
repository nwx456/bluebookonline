"use client";

import { useState, useEffect, useRef } from "react";
import { cropCanvasToDataUrl } from "@/lib/pdf-crop";

/** Bbox: pixel coordinates (x, y = top-left) or 0-1 normalized (legacy). */
export type PdfBbox = { x: number; y: number; width: number; height: number };

/** Renders a single PDF page (Macro/Micro graph). Uses cropCanvasToDataUrl for crop; displays as img for consistency. */
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
        const scale = 2;
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

        if (bbox && bbox.width > 0 && bbox.height > 0) {
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

          const isNormalized =
            bbox.x <= 1 && bbox.y <= 1 && bbox.width <= 1 && bbox.height <= 1;
          const rect = {
            x: isNormalized ? bbox.x * fullWidth : bbox.x,
            y: isNormalized ? bbox.y * fullHeight : bbox.y,
            width: isNormalized ? bbox.width * fullWidth : bbox.width,
            height: isNormalized ? bbox.height * fullHeight : bbox.height,
          };

          const dataUrl = cropCanvasToDataUrl(offScreen, rect, "image/png");
          if (cancelled) return;

          if (dataUrl) {
            const clampedW = Math.min(
              Math.floor(rect.width),
              fullWidth - Math.max(0, Math.floor(rect.x))
            );
            const clampedH = Math.min(
              Math.floor(rect.height),
              fullHeight - Math.max(0, Math.floor(rect.y))
            );
            const aspect = clampedW > 0 && clampedH > 0 ? clampedW / clampedH : 1;
            if (!cancelled) {
              setAspectRatio(aspect);
              setCropDataUrl(dataUrl);
              onRendered?.(dataUrl);
            }
          } else {
            canvas.width = fullWidth;
            canvas.height = fullHeight;
            ctx.drawImage(offScreen, 0, 0);
            if (!cancelled) setAspectRatio(fullWidth / fullHeight);
          }
        } else {
          canvas.width = fullWidth;
          canvas.height = fullHeight;
          await page.render({
            canvas,
            canvasContext: ctx,
            viewport,
          }).promise;
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
      {/* Canvas her zaman mount - effect için gerekli (ref deadlock önleme) */}
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
          style={{ imageRendering: "crisp-edges" } as React.CSSProperties}
        />
      )}
    </div>
  );
}
