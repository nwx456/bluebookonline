"use client";

import { SlideAmbientBackground } from "../SlideAmbientBackground";
import { usePresentationContent } from "../PresentationContentContext";
import { TeamPhotoCollage } from "../TeamPhotoCollage";

export function Slide05Team() {
  const { slideTeam } = usePresentationContent();

  return (
    <div className="relative h-full overflow-hidden">
      <SlideAmbientBackground variant="team" />

      <div className="absolute inset-0 z-0">
        <TeamPhotoCollage />
      </div>

      <div className="presentation-fade-up absolute inset-x-0 top-0 z-20 pt-14 sm:pt-16">
        <div className="mx-auto max-w-2xl rounded-b-2xl bg-white/85 px-6 pb-4 text-center shadow-sm backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 sm:text-base">
            {slideTeam.headline}
          </p>
          <h2 className="mt-2 text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
            {slideTeam.name}
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500" />
          <p className="mt-3 text-sm font-medium text-gray-600 sm:text-base">{slideTeam.role}</p>
          <a
            href={slideTeam.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-base font-semibold text-blue-600 underline underline-offset-4 transition-colors hover:text-blue-700 sm:text-lg"
          >
            {slideTeam.website}
          </a>
        </div>
      </div>
    </div>
  );
}
