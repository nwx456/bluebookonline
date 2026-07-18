/** College Board–style score report design tokens. */
export const scoreReport = {
  card: "rounded-lg border border-[#d1d5db] bg-white shadow-sm overflow-hidden",
  headerNavy: "bg-[#1e3a5f] text-white",
  subBarBlue: "bg-[#2563a8] text-white",
  totalBand: "bg-[#eef2f7]",
  scoreNumber: "text-[#111827] font-bold tabular-nums tracking-tight",
  labelMuted: "text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]",
  bodyText: "text-sm text-[#374151]",
  disclaimer: "text-[11px] text-[#6b7280] leading-relaxed",
  sectionDivider: "border-t border-[#e5e7eb]",
  linkBlue: "text-[#2563eb] underline underline-offset-2",
} as const;

export function formatScoreReportDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAttemptDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
