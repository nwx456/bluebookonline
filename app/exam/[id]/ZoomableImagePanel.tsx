"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Wraps graph/table content with zoom and pan.
 * Zoom: +/- buttons. Pan: overflow scroll when zoomed.
 */
export default function ZoomableImagePanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [zoomIndex, setZoomIndex] = useState(2); // default 1x
  const zoom = ZOOM_STEPS[zoomIndex];

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
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

  return (
    <div
      className={cn("w-full", className)}
      onWheel={handleWheel}
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="relative overflow-auto w-full max-w-full min-h-[200px] max-h-[70vh] rounded border border-gray-200 bg-gray-50">
        <div
          className="inline-block min-w-full"
          style={{ zoom } as React.CSSProperties}
        >
          {children}
        </div>
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded border border-gray-300 bg-white/90 shadow-sm">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            className="rounded-l px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="px-2 py-1 text-xs text-gray-500 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
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
