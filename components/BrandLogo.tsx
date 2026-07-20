import Image from "next/image";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/site-config";

/** Must match `public/logo.png` (see scripts/generate-logo-assets.mjs). */
export const LOGO_WIDTH = 1440;
export const LOGO_HEIGHT = 507;

const heightClasses = {
  header: "h-10 w-auto sm:h-11",
  hero: "h-16 w-auto sm:h-20 lg:h-24",
  exam: "h-9 w-auto sm:h-10",
  examHero: "h-14 w-auto sm:h-16",
} as const;

const sizeHints = {
  header: "(max-width: 640px) 120px, 160px",
  hero: "(max-width: 640px) 160px, (max-width: 1024px) 200px, 272px",
  exam: "(max-width: 640px) 100px, 128px",
  examHero: "(max-width: 640px) 140px, 180px",
} as const;

type BrandLogoProps = {
  size?: keyof typeof heightClasses;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = "header", className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt={SITE_NAME}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      sizes={sizeHints[size]}
      className={cn("block shrink-0 object-contain object-center", heightClasses[size], className)}
    />
  );
}
