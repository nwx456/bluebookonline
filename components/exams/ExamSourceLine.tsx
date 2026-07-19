import { formatSourceAttribution, type ExamSourceType } from "@/lib/exam-source";
import { cn } from "@/lib/utils";

type ExamSourceLineProps = {
  sourceType: string | null;
  sourceName: string | null;
  sourceUrl?: string | null;
  className?: string;
};

export function ExamSourceLine({
  sourceType,
  sourceName,
  sourceUrl,
  className = "",
}: ExamSourceLineProps) {
  const attribution = formatSourceAttribution({
    source_type: sourceType,
    source_name: sourceName,
    source_url: sourceUrl,
  });

  if (!attribution) return null;

  return (
    <span
      className={cn("min-w-0 truncate text-sm text-gray-600", className)}
      data-source-type={attribution.sourceType as ExamSourceType}
    >
      Source:{" "}
      {attribution.url ? (
        <a
          href={attribution.url}
          target="_blank"
          rel="noopener noreferrer"
          title={attribution.url}
          className="font-medium text-blue-600 hover:underline"
        >
          {attribution.sourceName}
        </a>
      ) : (
        <span className="text-gray-700">{attribution.sourceName}</span>
      )}
    </span>
  );
}
