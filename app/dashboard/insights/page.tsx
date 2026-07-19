"use client";

import { useEffect, useState } from "react";
import type { LibraryInsightsPayload } from "@/lib/library-types";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import { InsightsCharts } from "@/components/library/InsightsCharts";
import { InsightsKpiRow } from "@/components/library/InsightsKpiRow";
import { useProgram } from "@/lib/use-program";
import { getInsightsSubjectLabel } from "@/lib/insights-subject-label";
import { Download } from "lucide-react";

export default function DashboardInsightsPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const [subject, setSubject] = useState("");
  const [payload, setPayload] = useState<LibraryInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSubject("");
  }, [program]);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ program });
    if (subject) params.set("subject", subject);
    fetch(`/api/library/insights?${params.toString()}`, {
      headers: libraryAuthHeaders(accessToken),
    })
      .then((r) => r.json())
      .then((data) => setPayload(data.insights ?? null))
      .finally(() => setLoading(false));
  }, [accessToken, program, subject]);

  const exportQuery = () => {
    const params = new URLSearchParams({ program });
    if (subject) params.set("subject", subject);
    return params.toString();
  };

  const exportJson = async () => {
    if (!accessToken) return;
    const res = await fetch(`/api/library/export?format=json&${exportQuery()}`, {
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
    const res = await fetch(`/api/library/export?format=csv&${exportQuery()}`, {
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

  const overall = payload?.overall ?? null;
  const filtered = payload?.filtered ?? null;
  const selectedSubjectLabel = subject ? getInsightsSubjectLabel(subject) : null;
  const chartInsights = subject && filtered ? filtered : overall;

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

      {payload && payload.availableSubjects.length > 0 && (
        <div className="mb-6">
          <label htmlFor="insights-subject" className="mb-1 block text-xs font-medium text-gray-600">
            Filter by subject
          </label>
          <select
            id="insights-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="min-w-[200px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="">All subjects</option>
            {payload.availableSubjects.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({option.attemptCount})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading insights…</p>
      ) : !overall || overall.attemptCount === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">
            Complete an exam to see trends and weak-area summaries.
          </p>
        </div>
      ) : (
        <>
          <InsightsKpiRow
            title={subject ? "Overall" : undefined}
            insights={overall}
            program={program}
          />

          {subject && filtered && (
            <InsightsKpiRow
              title={selectedSubjectLabel ?? subject}
              insights={filtered}
              program={program}
              emptyMessage="No completed attempts for this subject yet."
            />
          )}

          {subject && filtered && filtered.attemptCount === 1 && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              One attempt logged for {selectedSubjectLabel} — complete another to unlock score
              deltas and richer trends.
            </div>
          )}

          {!subject && overall.attemptCount === 1 && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              One attempt logged — complete another to unlock score deltas and richer trends.
            </div>
          )}

          {chartInsights && (
            <InsightsCharts
              insights={chartInsights}
              overallInsights={overall}
              program={program}
              scopeLabel={selectedSubjectLabel ?? undefined}
              highlightSubject={subject || undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
