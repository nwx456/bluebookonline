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

type BrandLogoProps = {
  size?: keyof typeof heightClasses;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = "header", className, priority = false }: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={SITE_NAME}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("block shrink-0", heightClasses[size], className)}
    />
  );
}
