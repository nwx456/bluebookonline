import type { CompareSide } from "./types";

type FeatureCompareCardProps = {
  oldWay: CompareSide;
  newWay: CompareSide;
};

export function FeatureCompareCard({ oldWay, newWay }: FeatureCompareCardProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 sm:text-base">
          {oldWay.title}
        </p>
        <ul className="mt-4 space-y-3">
          {oldWay.items.map((item) => (
            <li key={item} className="flex gap-3 text-base text-gray-600 sm:text-lg">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gray-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 shadow-sm ring-1 ring-blue-100 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 sm:text-base">
          {newWay.title}
        </p>
        <ul className="mt-4 space-y-3">
          {newWay.items.map((item, index) => (
            <li key={item} className="flex gap-3 text-base text-gray-800 sm:text-lg">
              <span
                className="presentation-dot-pulse mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                style={{ animationDelay: `${index * 0.4}s` }}
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
