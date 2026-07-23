import { cn } from "@/lib/utils";

type InstitutionBadgeProps = {
  institutionName?: string | null;
  className?: string;
};

export function InstitutionBadge({ institutionName, className }: InstitutionBadgeProps) {
  const label = institutionName?.trim() || "Independent";
  const isIndependent = !institutionName?.trim();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        isIndependent
          ? "bg-gray-100 text-gray-700"
          : "bg-indigo-100 text-indigo-800",
        className
      )}
    >
      {label}
    </span>
  );
}
