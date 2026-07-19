"use client";

import type { LibraryInsights } from "@/lib/library-types";
import { InsightMetricLabel } from "@/components/library/InsightMetricHelp";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

function formatAvgScore(insights: LibraryInsights, program: "AP" | "SAT"): string {
  if (program === "SAT") {
    return insights.averageSatTotal != null ? String(insights.averageSatTotal) : "—";
  }
  return insights.averagePercentage != null ? `${insights.averagePercentage}%` : "—";
}

function formatScore(value: number | null, program: "AP" | "SAT"): string {
  if (value == null) return "—";
  return program === "SAT" ? String(value) : `${value}%`;
}

interface InsightsKpiRowProps {
  title?: string;
  insights: LibraryInsights;
  program: "AP" | "SAT";
  emptyMessage?: string;
}

export function InsightsKpiRow({
  title,
  insights,
  program,
  emptyMessage,
}: InsightsKpiRowProps) {
  const delta = insights.scoreDelta ?? null;
  const showDelta = insights.attemptCount > 1 && delta != null;

  if (insights.attemptCount === 0 && emptyMessage) {
    return (
      <div className="mb-6">
        {title && (
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
        )}
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {title && <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            <InsightMetricLabel metric="attempts">Attempts</InsightMetricLabel>
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {insights.attemptCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            <InsightMetricLabel metric="avgScore">
              {program === "SAT" ? "Avg score" : "Avg %"}
            </InsightMetricLabel>
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {formatAvgScore(insights, program)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            <InsightMetricLabel metric="best">Best</InsightMetricLabel>
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {formatScore(insights.bestScore, program)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            <InsightMetricLabel metric="trend">Trend</InsightMetricLabel>
          </p>
          {showDelta ? (
            <div className="mt-1 flex items-center gap-1.5">
              {delta > 0 ? (
                <ArrowUpRight className="h-5 w-5 text-green-600" />
              ) : delta < 0 ? (
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              ) : (
                <Minus className="h-5 w-5 text-gray-400" />
              )}
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-gray-900"
                }`}
              >
                {delta > 0 ? "+" : ""}
                {program === "SAT" ? delta : `${delta}%`}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              {insights.attemptCount === 1 ? "Single attempt" : "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
