"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { examUi } from "@/app/exam/exam-ui-tokens";
import { SLIDE_COUNT, type PresentationLocale } from "./content";
import {
  PresentationContentProvider,
  usePresentationContent,
} from "./PresentationContentContext";
import { SlideNavigation } from "./SlideNavigation";
import { SlideProgress } from "./SlideProgress";
import type { PresentationStats, SlideProps } from "./types";
import { Slide01OneLiner } from "./slides/Slide01OneLiner";
import { Slide02TwoSentencePitch } from "./slides/Slide02TwoSentencePitch";
import { Slide03Problem } from "./slides/Slide03Problem";
import { Slide04SolutionProduct } from "./slides/Slide04SolutionProduct";
import { Slide05Team } from "./slides/Slide05Team";
import "./presentation-animations.css";

type SlideEntry = {
  id: string;
  Component: ComponentType<SlideProps>;
};

const SLIDES: SlideEntry[] = [
  { id: "one-liner", Component: Slide01OneLiner as ComponentType<SlideProps> },
  { id: "pitch", Component: Slide02TwoSentencePitch },
  { id: "problem", Component: Slide03Problem as ComponentType<SlideProps> },
  { id: "solution", Component: Slide04SolutionProduct as ComponentType<SlideProps> },
  { id: "team", Component: Slide05Team as ComponentType<SlideProps> },
];

type PresentationShellProps = {
  locale: PresentationLocale;
  stats: PresentationStats;
  statsLoading: boolean;
};

function PresentationShellInner({ stats, statsLoading }: Omit<PresentationShellProps, "locale">) {
  const router = useRouter();
  const { ui } = usePresentationContent();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (index: number, dir: "next" | "prev") => {
      if (index < 0 || index >= SLIDE_COUNT || index === current || animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setAnimating(false);
      }, 200);
    },
    [current, animating]
  );

  const goNext = useCallback(() => goTo(current + 1, "next"), [current, goTo]);

  const goPrev = useCallback(() => {
    if (current === 0) {
      router.replace("/admin/mail");
      return;
    }
    goTo(current - 1, "prev");
  }, [current, goTo, router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0, "prev");
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(SLIDE_COUNT - 1, "next");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, goTo]);

  const slide = SLIDES[current];
  const SlideComponent = slide.Component;

  return (
    <div
      className={cn(examUi.examShellMobile, "bg-[#F9FAFB]")}
      role="region"
      aria-label={ui.regionLabel}
    >
      <SlideProgress current={current} />

      <div className="relative flex-1 overflow-hidden pb-20" aria-live="polite" aria-atomic="true">
        <div
          key={slide.id}
          className={cn(
            "presentation-slide-in absolute inset-0 transition-all duration-500 ease-out",
            animating
              ? direction === "next"
                ? "scale-[0.98] translate-x-6 opacity-0"
                : "scale-[0.98] -translate-x-6 opacity-0"
              : "scale-100 translate-x-0 opacity-100"
          )}
          style={
            {
              ["--slide-from" as string]: direction === "next" ? "24px" : "-24px",
            } as React.CSSProperties
          }
        >
          <SlideComponent stats={stats} statsLoading={statsLoading} />
        </div>
      </div>

      <SlideNavigation current={current} onPrev={goPrev} onNext={goNext} />
    </div>
  );
}

export function PresentationShell({ locale, stats, statsLoading }: PresentationShellProps) {
  return (
    <PresentationContentProvider locale={locale}>
      <PresentationShellInner stats={stats} statsLoading={statsLoading} />
    </PresentationContentProvider>
  );
}
