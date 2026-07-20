"use client";

import { SlideAmbientBackground } from "../SlideAmbientBackground";
import { usePresentationContent } from "../PresentationContentContext";

export function Slide03Problem() {
  const { slideProblem } = usePresentationContent();

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-6 sm:px-12 lg:px-16">
      <SlideAmbientBackground variant="problem" />

      <div className="relative z-10">
        <p
          className="presentation-fade-up text-sm font-semibold uppercase tracking-widest text-red-600 sm:text-base"
          style={{ animationDelay: "0ms" }}
        >
          {slideProblem.headline}
        </p>

        <blockquote
          className="presentation-fade-up mt-6 max-w-5xl border-l-4 border-red-500 pl-5 sm:pl-6"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-xl font-semibold leading-snug text-gray-900 sm:text-2xl lg:text-3xl">
            {slideProblem.statement}
          </p>
        </blockquote>

        <p
          className="presentation-fade-up mt-4 max-w-4xl text-base text-gray-600 sm:text-lg"
          style={{ animationDelay: "180ms" }}
        >
          {slideProblem.schoolPainLine}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {slideProblem.costs.map((cost, index) => (
            <div
              key={cost.label}
              className="presentation-fade-up rounded-2xl border border-gray-200 border-t-2 border-t-red-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              style={{ animationDelay: `${280 + index * 80}ms` }}
            >
              <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{cost.label}</p>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">{cost.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
