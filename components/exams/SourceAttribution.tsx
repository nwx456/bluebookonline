import { ExternalLink } from "lucide-react";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import {
  formatSourceAttribution,
  type ExamSourceType,
} from "@/lib/exam-source";

type SourceAttributionProps = {
  sourceType: string | null;
  sourceName: string | null;
  sourceUrl?: string | null;
  compact?: boolean;
  className?: string;
};

export function SourceAttribution({
  sourceType,
  sourceName,
  sourceUrl,
  compact = false,
  className = "",
}: SourceAttributionProps) {
  const attribution = formatSourceAttribution({
    source_type: sourceType,
    source_name: sourceName,
    source_url: sourceUrl,
  });

  if (!attribution) return null;

  return (
    <div
      className={`${compact ? "text-xs" : "text-sm"} text-gray-600 leading-relaxed ${className}`}
      data-source-type={attribution.sourceType as ExamSourceType}
    >
      <p>
        {attribution.text}
        {attribution.url ? (
          <>
            {" "}
            (
            <a
              href={attribution.url}
              target="_blank"
              rel="noopener noreferrer"
              title={attribution.url}
              className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:underline"
            >
              {attribution.linkLabel ?? attribution.url}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
            )
          </>
        ) : null}
      </p>
      <TrademarkDisclaimer
        variant="compact"
        className={`${compact ? "mt-1" : "mt-2"} !mx-0 !text-left`}
      />
    </div>
  );
}
