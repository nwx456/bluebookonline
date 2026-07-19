"use client";

import type { LibraryInsights } from "@/lib/library-types";
import { InsightMetricLabel } from "@/components/library/InsightMetricHelp";
import { getInsightsSubjectLabel } from "@/lib/insights-subject-label";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface InsightsChartsProps {
  insights: LibraryInsights;
  overallInsights: LibraryInsights;
  program: "AP" | "SAT";
  scopeLabel?: string;
  highlightSubject?: string;
}

function formatScore(value: number | null | undefined, program: "AP" | "SAT"): string {
  if (value == null) return "—";
  return program === "SAT" ? String(value) : `${value}%`;
}

function scoreFromTrendPoint(
  point: LibraryInsights["trend"][number],
  program: "AP" | "SAT"
): number | null {
  if (program === "SAT") return point.totalScaledScore;
  return point.percentage;
}

export function InsightsCharts({
  insights,
  overallInsights,
  program,
  scopeLabel,
  highlightSubject,
}: InsightsChartsProps) {
  const scoreTrend = insights.trend
    .map((point) => {
      const score = scoreFromTrendPoint(point, program);
      if (score == null) return null;
      return {
        id: point.id,
        label: new Date(point.completedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        score,
        title: point.title,
        examKind: point.examKind,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const subjectChart = overallInsights.subjectPerformance.slice(0, 6).map((row) => ({
    subjectKey: row.subject,
    subject: getInsightsSubjectLabel(row.subject),
    averageScore: row.averageScore ?? 0,
    mistakeCount: row.mistakeCount,
    attemptCount: row.attemptCount,
    highlighted: highlightSubject === row.subject,
  }));

  const satSections = insights.bySatSection.map((row) => ({
    name: row.section === "rw" ? "R&W" : "Math",
    mistakes: row.mistakeCount,
    averageScaled: row.averageScaled ?? 0,
  }));

  const pieColors = ["#2563eb", "#d97706"];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900">
          <InsightMetricLabel metric="scoreOverTime">Score over time</InsightMetricLabel>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {scopeLabel ? (
            <>Showing: {scopeLabel} · </>
          ) : null}
          {scoreTrend.length} completed {program} attempt{scoreTrend.length === 1 ? "" : "s"}
        </p>
        <div className="mt-4 h-64">
          {scoreTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No scored attempts yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  domain={program === "SAT" ? [400, 1600] : [0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof scoreTrend)[number];
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium text-gray-900">{row.title}</p>
                        <p className="text-gray-600">
                          Score: {formatScore(row.score, program)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          <InsightMetricLabel metric="weeklyActivity">Weekly activity</InsightMetricLabel>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {scopeLabel ? `Showing: ${scopeLabel} · ` : ""}
          Attempts in the last 8 weeks
        </p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={insights.weeklyAttempts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                formatter={(value) => [`${value}`, "Attempts"]}
                labelFormatter={(label) => `Week of ${label}`}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          <InsightMetricLabel metric="subjectPerformance">Subject performance</InsightMetricLabel>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Average score by subject
          {highlightSubject ? " (selected subject highlighted)" : ""}
        </p>
        <div className="mt-4 h-56">
          {subjectChart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No subject data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={subjectChart}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis
                  type="number"
                  domain={program === "SAT" ? [200, 800] : [0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  width={70}
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof subjectChart)[number];
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium text-gray-900">{row.subject}</p>
                        <p>Avg score: {formatScore(row.averageScore, program)}</p>
                        <p>Attempts: {row.attemptCount}</p>
                        <p>Mistakes: {row.mistakeCount}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="averageScore" radius={[0, 4, 4, 0]}>
                  {subjectChart.map((row) => (
                    <Cell
                      key={row.subjectKey}
                      fill={row.highlighted ? "#d97706" : "#2563eb"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {program === "SAT" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900">
            <InsightMetricLabel metric="satSections">SAT sections</InsightMetricLabel>
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {scopeLabel ? `Showing: ${scopeLabel} · ` : ""}
            Mistakes and average module scores
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={satSections}
                    dataKey="mistakes"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {satSections.map((_, index) => (
                      <Cell key={index} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}`, `${name} mistakes`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 gap-3 content-center sm:grid-cols-2">
              {satSections.map((row) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-500">{row.name}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
                    {row.averageScaled || "—"}
                  </p>
                  <p className="text-xs text-gray-500">avg. scaled</p>
                  <p className="mt-2 text-sm tabular-nums text-amber-700">{row.mistakes} mistakes</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900">
          <InsightMetricLabel metric="accuracyTrend">Accuracy trend</InsightMetricLabel>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {scopeLabel ? `Showing: ${scopeLabel} · ` : ""}
          Correct answers per attempt
        </p>
        <div className="mt-4 h-48">
          {insights.accuracyTrend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No accuracy data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights.accuracyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="completedAt"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as LibraryInsights["accuracyTrend"][number];
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium text-gray-900">{row.title}</p>
                        <p className="text-gray-600">Accuracy: {row.accuracy}%</p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#d97706" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
