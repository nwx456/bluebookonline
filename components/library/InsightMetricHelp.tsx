"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  INSIGHTS_METRIC_COPY,
  type InsightsMetricKey,
} from "@/lib/insights-metric-copy";
import { cn } from "@/lib/utils";

interface InsightMetricHelpProps {
  metric: InsightsMetricKey;
  className?: string;
}

export function InsightMetricHelp({ metric, className }: InsightMetricHelpProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copy = INSIGHTS_METRIC_COPY[metric];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="What does this mean?"
        aria-expanded={open}
        className="inline-flex rounded-full p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-lg sm:w-64"
        >
          <p className="text-xs font-semibold text-gray-900">{copy.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{copy.description}</p>
        </div>
      )}
    </div>
  );
}

interface InsightMetricLabelProps {
  metric: InsightsMetricKey;
  children: React.ReactNode;
  className?: string;
}

export function InsightMetricLabel({ metric, children, className }: InsightMetricLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <InsightMetricHelp metric={metric} />
    </span>
  );
}
