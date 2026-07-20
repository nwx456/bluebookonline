"use client";

import Image from "next/image";
import { SUBJECT_KEYS } from "@/lib/gemini-prompts";
import { FRQ_COURSE_IDS } from "@/lib/frq-courses";
import { FeatureCompareCard } from "../FeatureCompareCard";
import { SlideAmbientBackground } from "../SlideAmbientBackground";
import { usePresentationContent } from "../PresentationContentContext";

export function Slide04SolutionProduct() {
  const { slideSolution } = usePresentationContent();
  const apMcqCount = SUBJECT_KEYS.filter((k) => !k.startsWith("SAT")).length;
  const badgeLabels = slideSolution.formatBadgeLabels(apMcqCount, FRQ_COURSE_IDS.length);

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-6 py-6 sm:px-10 sm:py-8 lg:px-12">
      <SlideAmbientBackground variant="solution" />

      <div className="relative z-10">
        <p
          className="presentation-fade-up text-sm font-semibold uppercase tracking-widest text-blue-600 sm:text-base"
          style={{ animationDelay: "0ms" }}
        >
          {slideSolution.headline}
        </p>

        <p
          className="presentation-fade-up mt-2 max-w-4xl text-base font-medium text-gray-800 sm:text-lg"
          style={{ animationDelay: "60ms" }}
        >
          {slideSolution.institutionalCallout}
        </p>

        <div className="presentation-fade-up mt-4" style={{ animationDelay: "120ms" }}>
          <FeatureCompareCard oldWay={slideSolution.oldWay} newWay={slideSolution.newWay} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-5 lg:gap-4">
          <div
            className="presentation-scale-in overflow-hidden rounded-xl border-2 border-blue-200 bg-white shadow-lg shadow-blue-200/40 ring-2 ring-blue-200/60 lg:col-span-3"
            style={{ animationDelay: "180ms" }}
          >
            <Image
              src={slideSolution.interfaceImage}
              alt={slideSolution.interfaceImageAlt}
              width={1200}
              height={750}
              className="h-auto max-h-[28vh] w-full object-cover object-top lg:max-h-[32vh]"
              priority
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            {slideSolution.coreFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className="presentation-fade-up rounded-xl border border-gray-200 border-l-2 border-l-blue-400 bg-white p-3 shadow-sm sm:p-4"
                style={{ animationDelay: `${240 + index * 60}ms` }}
              >
                <p className="text-base font-bold text-gray-900 sm:text-lg">{feature.title}</p>
                <p className="mt-1 text-sm text-gray-600 sm:text-base">{feature.description}</p>
                <p className="mt-1 font-mono text-xs text-blue-600">{feature.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="presentation-fade-up mt-3 flex flex-wrap gap-2"
          style={{ animationDelay: "420ms" }}
        >
          {badgeLabels.map((label, index) => (
            <span
              key={label}
              className="presentation-scale-in rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 sm:text-sm"
              style={{ animationDelay: `${480 + index * 50}ms` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
