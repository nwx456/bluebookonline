import {
  TRADEMARK_DISCLAIMER_EN,
  TRADEMARK_DISCLAIMER_TR,
} from "@/lib/legal/trademark-disclaimer";

type TrademarkDisclaimerProps = {
  variant?: "full" | "compact" | "callout";
  className?: string;
};

export function TrademarkDisclaimer({
  variant = "full",
  className = "",
}: TrademarkDisclaimerProps) {
  const isCompact = variant === "compact";
  const isCallout = variant === "callout";

  const enClass = isCompact
    ? "text-xs text-gray-500 leading-relaxed"
    : isCallout
      ? "text-sm text-amber-900 leading-relaxed"
      : "text-sm text-gray-600 leading-relaxed";

  const trClass = isCompact
    ? "mt-1 text-[11px] text-gray-400 leading-relaxed"
    : isCallout
      ? "mt-2 text-xs text-amber-800/80 leading-relaxed"
      : "mt-2 text-xs text-gray-500 leading-relaxed";

  const wrapperClass = [
    isCallout
      ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
      : isCompact
        ? "max-w-3xl mx-auto text-center"
        : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      role="note"
      aria-label="Trademark disclaimer"
      className={wrapperClass || undefined}
    >
      <p className={enClass}>{TRADEMARK_DISCLAIMER_EN}</p>
      <p lang="tr" className={trClass}>
        {TRADEMARK_DISCLAIMER_TR}
      </p>
    </aside>
  );
}
