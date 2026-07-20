"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLIDE_COUNT } from "./content";
import { usePresentationContent } from "./PresentationContentContext";

type SlideNavigationProps = {
  current: number;
  onPrev: () => void;
  onNext: () => void;
};

export function SlideNavigation({ current, onPrev, onNext }: SlideNavigationProps) {
  const { ui } = usePresentationContent();
  const isLast = current === SLIDE_COUNT - 1;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-4 px-4 pb-6 pt-4 safe-area-bottom">
      <div className="flex items-center gap-4 rounded-full border border-gray-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={onPrev}
          aria-label={current === 0 ? ui.backToAdmin : ui.prevSlide}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:ml-1 sm:text-base sm:font-medium">{ui.back}</span>
        </button>

        <span className="min-w-[5rem] text-center text-base font-medium tabular-nums text-gray-600">
          {current + 1} / {SLIDE_COUNT}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={isLast}
          aria-label={ui.nextSlide}
          className={cn(
            "inline-flex min-h-12 min-w-12 items-center justify-center rounded-full px-2 transition-colors",
            isLast
              ? "cursor-not-allowed text-gray-300"
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          <span className="sr-only sm:not-sr-only sm:mr-1 sm:text-base sm:font-medium">{ui.next}</span>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
