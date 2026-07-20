"use client";

import { SlideAmbientBackground } from "../SlideAmbientBackground";
import { usePresentationContent } from "../PresentationContentContext";
import type { SlideProps } from "../types";

export function Slide02TwoSentencePitch({ stats, statsLoading }: SlideProps) {
  const { slideTwoSentence, formatPitchSentence1 } = usePresentationContent();
  const sentence1 = formatPitchSentence1(
    stats.registeredUsers,
    stats.attemptsCompleted,
    stats.pdfUploadsTotal
  );

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-6 sm:px-12 lg:px-16">
      <SlideAmbientBackground variant="pitch" />

      <div className="relative z-10">
        <p
          className="presentation-fade-up text-sm font-semibold uppercase tracking-widest text-blue-600 sm:text-base"
          style={{ animationDelay: "0ms" }}
        >
          {slideTwoSentence.pitchLabel}
        </p>
        <p
          className="presentation-fade-up mt-2 max-w-4xl text-sm text-gray-500 sm:text-base lg:text-lg"
          style={{ animationDelay: "80ms" }}
        >
          {slideTwoSentence.base}
        </p>

        <div className="mt-6 space-y-5">
          <div
            className="presentation-fade-up presentation-card-glow rounded-2xl border border-blue-100/80 bg-white p-6 shadow-md sm:p-7"
            style={{ animationDelay: "160ms" }}
          >
            <p className="text-lg font-medium leading-relaxed text-gray-900 sm:text-xl lg:text-2xl">
              {sentence1}
              {statsLoading && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {slideTwoSentence.statsUpdating}
                </span>
              )}
            </p>
          </div>

          <div
            className="presentation-fade-up rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-md sm:p-7"
            style={{ animationDelay: "280ms" }}
          >
            <p className="text-lg font-medium leading-relaxed text-gray-900 sm:text-xl lg:text-2xl">
              {slideTwoSentence.sentence2}
            </p>
          </div>

          <div
            className="presentation-fade-up rounded-xl border border-blue-200 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 px-6 py-4 sm:px-7 sm:py-5"
            style={{ animationDelay: "400ms" }}
          >
            <p className="text-left text-base font-medium leading-relaxed text-blue-800 sm:text-lg">
              {slideTwoSentence.institutionalHighlight}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
