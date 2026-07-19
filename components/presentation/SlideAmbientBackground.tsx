import { cn } from "@/lib/utils";

type AmbientVariant = "hero" | "pitch" | "problem" | "solution" | "team";

type SlideAmbientBackgroundProps = {
  variant: AmbientVariant;
};

const VARIANT_STYLES: Record<
  AmbientVariant,
  { gradient: string; orbs: { className: string; delay: string }[] }
> = {
  hero: {
    gradient: "bg-gradient-to-br from-blue-50 via-[#F9FAFB] to-white",
    orbs: [
      { className: "left-[-5%] top-[20%] h-72 w-72 bg-blue-400/15", delay: "0s" },
      { className: "right-[-5%] bottom-[15%] h-64 w-64 bg-indigo-400/12", delay: "-8s" },
      { className: "right-[15%] top-[5%] h-48 w-48 bg-sky-300/8", delay: "-16s" },
    ],
  },
  pitch: {
    gradient: "bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40",
    orbs: [
      { className: "left-[5%] top-[20%] h-80 w-80 bg-blue-500/15", delay: "0s" },
      { className: "right-[10%] top-[40%] h-56 w-56 bg-indigo-400/12", delay: "-10s" },
    ],
  },
  problem: {
    gradient: "bg-gradient-to-br from-rose-50/60 via-[#F9FAFB] to-amber-50/30",
    orbs: [
      { className: "left-[8%] top-[25%] h-72 w-72 bg-rose-400/15", delay: "0s" },
      { className: "right-[5%] bottom-[25%] h-64 w-64 bg-amber-400/12", delay: "-12s" },
    ],
  },
  solution: {
    gradient: "bg-gradient-to-br from-blue-50/70 via-white to-emerald-50/30",
    orbs: [
      { className: "left-[12%] top-[15%] h-64 w-64 bg-blue-400/15", delay: "0s" },
      { className: "right-[8%] top-[30%] h-72 w-72 bg-emerald-400/10", delay: "-9s" },
      { className: "left-[50%] bottom-[15%] h-48 w-48 bg-blue-300/10", delay: "-18s" },
    ],
  },
  team: {
    gradient: "bg-gradient-to-br from-indigo-50/70 via-[#F9FAFB] to-violet-50/40",
    orbs: [
      { className: "left-[15%] top-[10%] h-64 w-64 bg-indigo-400/15", delay: "0s" },
      { className: "right-[12%] top-[20%] h-56 w-56 bg-violet-400/12", delay: "-11s" },
      { className: "left-[45%] bottom-[8%] h-72 w-72 bg-blue-400/10", delay: "-20s" },
    ],
  },
};

export function SlideAmbientBackground({ variant }: SlideAmbientBackgroundProps) {
  const { gradient, orbs } = VARIANT_STYLES[variant];

  return (
    <div className={cn("absolute inset-0 overflow-hidden", gradient)} aria-hidden>
      {orbs.map((orb, index) => (
        <div
          key={index}
          className={cn(
            "presentation-ambient-orb absolute rounded-full blur-3xl",
            orb.className
          )}
          style={{ animationDelay: orb.delay }}
        />
      ))}
    </div>
  );
}
