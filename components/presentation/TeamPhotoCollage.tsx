"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { TEAM_COLLAGE_PHOTOS } from "./content/tr";

export function TeamPhotoCollage() {
  return (
    <div className="grid h-full w-full grid-cols-4 grid-rows-3 gap-2 p-2 pb-24 sm:gap-3 sm:p-3">
      {TEAM_COLLAGE_PHOTOS.map((photo, index) => (
        <div
          key={photo.src}
          className={cn(
            "presentation-photo-enter relative min-h-0 overflow-hidden rounded-xl border-[3px] border-white shadow-lg shadow-blue-900/10 sm:rounded-2xl sm:border-4",
            "transition-transform duration-300 hover:z-10 hover:scale-[1.04] hover:!rotate-0"
          )}
          style={{
            ["--rotate" as string]: `${photo.rotate ?? 0}deg`,
            animationDelay: `${index * 60}ms, ${480 + index * 90}ms`,
          }}
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 768px) 28vw, 22vw"
            className="object-cover"
            style={{ objectPosition: photo.objectPosition ?? "center center" }}
          />
        </div>
      ))}
    </div>
  );
}
