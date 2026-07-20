"use client";

import { cn } from "@/lib/utils";
import { SLIDE_COUNT } from "./content";
import { usePresentationContent } from "./PresentationContentContext";

type SlideProgressProps = {
  current: number;
  total?: number;
};

export function SlideProgress({ current, total = SLIDE_COUNT }: SlideProgressProps) {
  const { ui } = usePresentationContent();
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="absolute inset-x-0 top-0 z-20">
      <div className="h-1 w-full bg-gray-200/80">
        <div
          className="h-full bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={current + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={ui.slideProgress(current + 1, total)}
        />
      </div>
      <div className="flex justify-center gap-1.5 pt-3">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === current ? "w-6 bg-blue-600" : "w-1.5 bg-gray-300"
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
