"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
const DEFAULT_ZOOM_INDEX = 2;
const PAN_THRESHOLD_PX = 3;

/**
 * Wraps graph/table content with zoom and pan.
 * Re-measures whenever a child <img> finishes loading or the content resizes.
 * Supports left-click drag to pan (mouse only); native touch scrolling is left intact.
 */
export default function ZoomableImagePanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const zoom = ZOOM_STEPS[zoomIndex];
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [measuredSize, setMeasuredSize] = useState<{ w: number; h: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    moved: false,
  });

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0 && h > 0) {
      setMeasuredSize((prev) =>
        prev && prev.w === w && prev.h === h ? prev : { w, h }
      );
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();

    const imgs = Array.from(el.querySelectorAll("img"));
    const handlers: Array<{ img: HTMLImageElement; handler: () => void }> = [];
    for (const img of imgs) {
      const handler = () => measure();
      if (!img.complete) {
        img.addEventListener("load", handler);
        img.addEventListener("error", handler);
        handlers.push({ img, handler });
      }
    }

    return () => {
      observer.disconnect();
      for (const { img, handler } of handlers) {
        img.removeEventListener("load", handler);
        img.removeEventListener("error", handler);
      }
    };
  }, [children, measure]);

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
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
    const ps = panStateRef.current;
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
      // ignore — capture is best-effort
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ps = panStateRef.current;
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
    const ps = panStateRef.current;
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

  const showTransformZoom = measuredSize && measuredSize.w > 0 && measuredSize.h > 0;

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
      >
        {showTransformZoom ? (
          <div
            style={{
              width: measuredSize!.w * zoom,
              height: measuredSize!.h * zoom,
              minWidth: "100%",
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: measuredSize!.w,
                height: measuredSize!.h,
              }}
            >
              <div ref={contentRef} className="inline-block">
                {children}
              </div>
            </div>
          </div>
        ) : (
          <div ref={contentRef} className="inline-block min-w-full">
            {children}
          </div>
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
            onClick={resetZoom}
            className="px-2 py-1 text-xs text-gray-500 tabular-nums hover:bg-gray-100"
            aria-label="Reset zoom"
            title="Reset zoom"
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
