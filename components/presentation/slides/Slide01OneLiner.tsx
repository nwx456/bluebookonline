"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { SlideAmbientBackground } from "../SlideAmbientBackground";
import { usePresentationContent } from "../PresentationContentContext";

export function Slide01OneLiner() {
  const { slideOneLiner, slideOneTagline } = usePresentationContent();

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <SlideAmbientBackground variant="hero" />
      <div className="relative z-10 flex max-w-5xl flex-col items-center gap-6">
        <div className="presentation-scale-in" style={{ animationDelay: "0ms" }}>
          <div className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-gray-100">
            <BrandLogo size="hero" priority />
          </div>
        </div>
        <h1
          className="presentation-fade-up text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "120ms" }}
        >
          {slideOneLiner}
        </h1>
        <p
          className="presentation-fade-up max-w-2xl text-base text-blue-600/70 sm:text-lg lg:text-xl"
          style={{ animationDelay: "240ms" }}
        >
          {slideOneTagline}
        </p>
      </div>
    </div>
  );
}
