"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isLikelyNormalized, prepareCropRect } from "@/lib/pdf-geometry";
import { cropCanvasToDataUrl } from "@/lib/pdf-crop";

export type ExploreBbox = { x: number; y: number; width: number; height: number };

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
const DEFAULT_ZOOM_INDEX = 2;
const PAN_THRESHOLD_PX = 3;

/**
 * Renders the full PDF page so the user can drag-pan around the entire page,
 * but starts focused on the question's bbox so the graph/table is visible
 * by default. Falls back to the full page view when no bbox is supplied.
 */
export default function PdfExplorePanel({
  pdfUrl,
  pageNumber,
  bbox,
  onRendered,
  className,
}: {
  pdfUrl: string;
  pageNumber: number;
  bbox?: ExploreBbox | null;
  onRendered?: (dataUrl: string) => void;
  className?: string;
}) {
  const [pageImgUrl, setPageImgUrl] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [bboxPx, setBboxPx] = useState<ExploreBbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [isPanning, setIsPanning] = useState(false);
  const zoom = ZOOM_STEPS[zoomIndex];

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const onRenderedRef = useRef(onRendered);

  const panState = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    moved: false,
  });

  useEffect(() => {
    onRenderedRef.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    if (!pdfUrl || pageNumber < 1) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageImgUrl(null);
    setPageSize(null);
    setBboxPx(null);
    initialScrollDoneRef.current = false;
    setZoomIndex(DEFAULT_ZOOM_INDEX);

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
        const offScreen = document.createElement("canvas");
        offScreen.width = viewport.width;
        offScreen.height = viewport.height;
        const offCtx = offScreen.getContext("2d");
        if (!offCtx) return;
        await page.render({
          canvas: offScreen,
          canvasContext: offCtx,
          viewport,
        }).promise;
        if (cancelled) return;
        const dataUrl = offScreen.toDataURL("image/png");
        if (cancelled) return;
        setPageImgUrl(dataUrl);
        setPageSize({ w: viewport.width, h: viewport.height });

        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const normalized = isLikelyNormalized(bbox);
          const px: ExploreBbox = normalized
            ? {
                x: bbox.x * viewport.width,
                y: bbox.y * viewport.height,
                width: bbox.width * viewport.width,
                height: bbox.height * viewport.height,
              }
            : { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
          setBboxPx(px);

          const cb = onRenderedRef.current;
          if (cb) {
            try {
              const prepared = prepareCropRect(bbox, viewport.width, viewport.height);
              const cropUrl = cropCanvasToDataUrl(offScreen, prepared.rect, "image/png");
              if (cropUrl) cb(cropUrl);
            } catch {
              // ignore — crop save is best-effort
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber, bbox]);

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const update = () => setContainerW(sc.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(sc);
    update();
    return () => observer.disconnect();
  }, []);

  const baseFactor = useMemo(() => {
    if (!pageSize || containerW <= 0) return 0;
    if (bboxPx && bboxPx.width > 0) return containerW / bboxPx.width;
    return containerW / pageSize.w;
  }, [pageSize, containerW, bboxPx]);

  const totalScale = baseFactor * zoom;
  const imgW = pageSize ? pageSize.w * totalScale : 0;
  const imgH = pageSize ? pageSize.h * totalScale : 0;

  const aspectRatio = useMemo(() => {
    if (bboxPx && bboxPx.width > 0 && bboxPx.height > 0) {
      return bboxPx.width / bboxPx.height;
    }
    if (pageSize && pageSize.w > 0 && pageSize.h > 0) {
      return pageSize.w / pageSize.h;
    }
    return 4 / 3;
  }, [bboxPx, pageSize]);

  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    const sc = scrollRef.current;
    if (!sc || !pageSize || baseFactor <= 0 || imgW <= 0 || imgH <= 0) return;
    if (bboxPx) {
      sc.scrollLeft = Math.max(0, bboxPx.x * totalScale);
      sc.scrollTop = Math.max(0, bboxPx.y * totalScale);
    } else {
      sc.scrollLeft = 0;
      sc.scrollTop = 0;
    }
    initialScrollDoneRef.current = true;
  }, [bboxPx, pageSize, baseFactor, imgW, imgH, totalScale]);

  const zoomAround = useCallback(
    (newIndex: number) => {
      setZoomIndex((prevIndex) => {
        const clamped = Math.max(0, Math.min(ZOOM_STEPS.length - 1, newIndex));
        if (clamped === prevIndex) return prevIndex;
        const sc = scrollRef.current;
        if (sc) {
          const ratio = ZOOM_STEPS[clamped] / ZOOM_STEPS[prevIndex];
          const vpW = sc.clientWidth;
          const vpH = sc.clientHeight;
          const cx = sc.scrollLeft + vpW / 2;
          const cy = sc.scrollTop + vpH / 2;
          requestAnimationFrame(() => {
            const sc2 = scrollRef.current;
            if (!sc2) return;
            sc2.scrollLeft = Math.max(0, cx * ratio - vpW / 2);
            sc2.scrollTop = Math.max(0, cy * ratio - vpH / 2);
          });
        }
        return clamped;
      });
    },
    []
  );

  const zoomIn = useCallback(() => zoomAround(zoomIndex + 1), [zoomAround, zoomIndex]);
  const zoomOut = useCallback(() => zoomAround(zoomIndex - 1), [zoomAround, zoomIndex]);

  const resetView = useCallback(() => {
    initialScrollDoneRef.current = false;
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    },
    [zoomIn, zoomOut]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest("[data-no-pan]")) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const ps = panState.current;
    ps.active = true;
    ps.pointerId = e.pointerId;
    ps.startX = e.clientX;
    ps.startY = e.clientY;
    ps.startScrollLeft = sc.scrollLeft;
    ps.startScrollTop = sc.scrollTop;
    ps.moved = false;
    try {
      sc.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ps = panState.current;
    if (!ps.active || ps.pointerId !== e.pointerId) return;
    const dx = e.clientX - ps.startX;
    const dy = e.clientY - ps.startY;
    if (!ps.moved && Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
    if (!ps.moved) {
      ps.moved = true;
      setIsPanning(true);
    }
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollLeft = ps.startScrollLeft - dx;
    sc.scrollTop = ps.startScrollTop - dy;
    e.preventDefault();
  }, []);

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ps = panState.current;
    if (!ps.active || ps.pointerId !== e.pointerId) return;
    ps.active = false;
    ps.pointerId = -1;
    if (ps.moved) {
      ps.moved = false;
      setIsPanning(false);
    }
    const sc = scrollRef.current;
    if (sc) {
      try {
        sc.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div
      className={cn("w-full min-w-0", className)}
      onWheel={handleWheel}
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={cn(
          "relative overflow-auto w-full max-w-full min-h-[220px] max-h-[85vh] rounded border border-gray-200 bg-gray-50",
          isPanning ? "cursor-grabbing select-none" : "cursor-grab"
        )}
        style={{ aspectRatio }}
      >
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-red-600 px-4 text-center">
            {error}
          </p>
        ) : loading || !pageImgUrl ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            Loading PDF page…
          </p>
        ) : (
          <img
            src={pageImgUrl}
            alt="PDF page"
            draggable={false}
            style={{
              display: "block",
              width: imgW > 0 ? `${imgW}px` : "100%",
              height: imgH > 0 ? `${imgH}px` : "auto",
              maxWidth: "none",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
        <div
          data-no-pan
          className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded border border-gray-300 bg-white/95 shadow-sm cursor-default"
        >
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            className="rounded-l px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetView}
            className="px-2 py-1 text-xs text-gray-500 tabular-nums hover:bg-gray-100"
            aria-label="Reset view"
            title="Reset zoom and focus"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            className="rounded-r px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
