"use client";

import { useEffect, useState } from "react";
import type { LibraryInsights } from "@/lib/library-types";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import { InsightsCharts } from "@/components/library/InsightsCharts";
import { useProgram } from "@/lib/use-program";
import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";

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

export default function DashboardInsightsPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const [insights, setInsights] = useState<LibraryInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetch(`/api/library/insights?program=${program}`, {
      headers: libraryAuthHeaders(accessToken),
    })
      .then((r) => r.json())
      .then((data) => setInsights(data.insights ?? null))
      .finally(() => setLoading(false));
  }, [accessToken, program]);

  const exportJson = async () => {
    if (!accessToken) return;
    const res = await fetch(`/api/library/export?format=json&program=${program}`, {
      headers: libraryAuthHeaders(accessToken),
    });
    const blob = new Blob([JSON.stringify(await res.json(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-insights-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    if (!accessToken) return;
    const res = await fetch(`/api/library/export?format=csv&program=${program}`, {
      headers: libraryAuthHeaders(accessToken),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const delta = insights?.scoreDelta ?? null;
  const showDelta = insights != null && insights.attemptCount > 1 && delta != null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Insights</h1>
          <p className="mt-1 text-sm text-gray-600">
            Score trends and weak spots from your completed {program} attempts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void exportJson()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            JSON
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading insights…</p>
      ) : !insights || insights.attemptCount === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">
            Complete an exam to see trends and weak-area summaries.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">Attempts</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {insights.attemptCount}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {program === "SAT" ? "Avg score" : "Avg %"}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {formatAvgScore(insights, program)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">Best</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {formatScore(insights.bestScore, program)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-500">Trend</p>
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

          {insights.attemptCount === 1 && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              One attempt logged — complete another to unlock score deltas and richer trends.
            </div>
          )}

          <InsightsCharts insights={insights} program={program} />
        </>
      )}
    </div>
  );
}
