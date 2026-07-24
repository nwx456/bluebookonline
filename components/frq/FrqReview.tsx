"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, LayoutDashboard, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ExamSourceLine } from "@/components/exams/ExamSourceLine";
import { cn } from "@/lib/utils";
import { formatScoreReportDate, scoreReport } from "@/app/exam/score-report-tokens";
import {
  computePointsLost,
  formatPointsLostLabel,
  getMissedRubricRows,
} from "@/lib/frq-score-display";
import type { RubricRow } from "@/components/frq/FrqScoreReportCard";

export type FrqReviewResponse = {
  questionNumber: number;
  partLabel: string;
  displayLabel: string;
  partPrompt: string;
  score: number | null;
  maxPoints: number;
  feedback: string | null;
  rubricBreakdown: RubricRow[] | null;
  strengths: string[] | null;
  improvements: string[] | null;
  responseText: string;
};

type Props = {
  courseLabel: string;
  title: string;
  totalScore: number;
  maxScore: number;
  completedAt?: string | null;
  responses: FrqReviewResponse[];
  frqUploadId?: string;
  isPubliclyVisible?: boolean;
  sourceType?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
};


function scoreStatus(score: number | null, maxPoints: number): "full" | "partial" | "zero" | "empty" {
  if (maxPoints <= 0) return "empty";
  const earned = score ?? 0;
  if (earned <= 0) return "zero";
  if (earned >= maxPoints) return "full";
  return "partial";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function FrqReview({
  courseLabel,
  title,
  totalScore,
  maxScore,
  completedAt,
  responses,
  frqUploadId,
  isPubliclyVisible,
  sourceType,
  sourceName,
  sourceUrl,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const totalLost = computePointsLost(totalScore, maxScore);

  const grouped = useMemo(() => {
    const map = new Map<number, FrqReviewResponse[]>();
    for (const r of responses) {
      const list = map.get(r.questionNumber) ?? [];
      list.push(r);
      map.set(r.questionNumber, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [responses]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return responses.find((r) => `${r.questionNumber}::${r.partLabel}` === selectedKey) ?? null;
  }, [responses, selectedKey]);

  const selectedMissedRows = selected ? getMissedRubricRows(selected.rubricBreakdown) : [];
  const selectedPartLost = selected
    ? computePointsLost(selected.score, selected.maxPoints)
    : 0;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 max-w-2xl mx-auto w-full">
          <Link href="/" className="shrink-0 min-w-0 justify-self-start">
            <BrandLogo size="exam" />
          </Link>
          <h1 className="text-center text-sm sm:text-base font-semibold text-gray-900 truncate px-2">
            {courseLabel}
          </h1>
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="flex items-center gap-2 rounded-md px-2 py-2 sm:px-4 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600 justify-self-end"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className={cn(scoreReport.card)}>
            <div className={cn(scoreReport.headerNavy, "px-6 py-4")}>
              <p className="text-base sm:text-lg font-medium leading-snug text-center">
                {courseLabel} — Section II
              </p>
              <p className="mt-1 text-center text-xs text-white/75 truncate">{title}</p>
            </div>

            <div className="px-6 py-8 text-center">
              <p className={scoreReport.labelMuted}>Your Score</p>
              <p className="mt-2 text-4xl font-bold text-gray-900 tabular-nums">
                {totalScore}{" "}
                <span className="text-2xl font-normal text-gray-500">/ {maxScore}</span>
              </p>
              <p className="mt-1 text-sm text-gray-500">{pct}%</p>
              {totalLost > 0 ? (
                <p className="mt-2 text-sm font-medium text-red-700 tabular-nums">
                  Points lost: {totalLost} of {maxScore}
                </p>
              ) : maxScore > 0 ? (
                <p className="mt-2 text-sm font-medium text-green-700">Full credit</p>
              ) : null}
              {completedAt && (
                <p className="mt-3 text-xs text-gray-400">
                  Completed {formatScoreReportDate(completedAt)}
                </p>
              )}
            </div>

            <div className={cn(scoreReport.sectionDivider, "px-6 py-3 space-y-3")}>
              <ExamSourceLine
                sourceType={sourceType ?? null}
                sourceName={sourceName ?? null}
                sourceUrl={sourceUrl ?? null}
              />
              <p className={scoreReport.disclaimer}>
                Scored using AI based on College Board FRQ rubrics. This is practice feedback, not an official AP score.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Note:</strong> AI-generated scores and feedback are for reference only and may not match official AP scoring.
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Question Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Click a row to view your response, rubric breakdown, and where you lost points
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {grouped.map(([questionNumber, parts]) => {
                const questionScore = parts.reduce((s, p) => s + (p.score ?? 0), 0);
                const questionMax = parts.reduce((s, p) => s + p.maxPoints, 0);
                const questionLost = computePointsLost(questionScore, questionMax);
                return (
                  <details key={questionNumber} className="group" open>
                    <summary className="cursor-pointer bg-gray-50/80 px-4 py-3 font-medium text-gray-900 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">Question {questionNumber}</span>
                      </span>
                      <span className="text-sm font-normal text-gray-500 shrink-0 ml-2 tabular-nums">
                        {questionScore}/{questionMax} pts
                        {questionLost > 0 ? (
                          <span className="ml-2 text-red-600">−{questionLost}</span>
                        ) : null}
                      </span>
                    </summary>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Part</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Score</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Points lost</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parts.map((row) => {
                            const key = `${row.questionNumber}::${row.partLabel}`;
                            const status = scoreStatus(row.score, row.maxPoints);
                            const lost = computePointsLost(row.score, row.maxPoints);
                            return (
                              <tr
                                key={key}
                                onClick={() => setSelectedKey(key)}
                                className={cn(
                                  "border-b border-gray-100 cursor-pointer transition-colors",
                                  selectedKey === key ? "bg-blue-50" : "hover:bg-gray-50"
                                )}
                              >
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {row.displayLabel}
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                  {row.score ?? 0} / {row.maxPoints}
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                  {lost > 0 ? (
                                    <span className="font-medium text-red-600">{lost}</span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                      status === "full" && "bg-green-100 text-green-800",
                                      status === "partial" && "bg-amber-100 text-amber-900",
                                      status === "zero" && "bg-red-100 text-red-800",
                                      status === "empty" && "bg-gray-100 text-gray-600"
                                    )}
                                  >
                                    {status === "full"
                                      ? "Full credit"
                                      : status === "partial"
                                        ? "Partial credit"
                                        : status === "zero"
                                          ? "No credit"
                                          : "Unscored"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Question {selected.displayLabel}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
              </div>

              {selected.partPrompt && (
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Part prompt
                  </p>
                  <p className="text-sm text-gray-800">{stripHtml(selected.partPrompt)}</p>
                </div>
              )}

              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Score:</span>
                  <span className="text-sm font-semibold text-blue-700 tabular-nums">
                    {selected.score ?? 0} / {selected.maxPoints} pts
                  </span>
                </div>
                {selectedPartLost > 0 && (
                  <p className="mt-1 text-sm font-medium text-red-700">
                    {formatPointsLostLabel(selectedPartLost, selected.maxPoints)} on this part
                  </p>
                )}
              </div>

              {selectedMissedRows.length > 0 && (
                <div className="mb-4 rounded-md border border-red-100 bg-red-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-800 mb-2">
                    Where you lost points
                  </p>
                  <ul className="space-y-2">
                    {selectedMissedRows.map((row, i) => (
                      <li key={i} className="text-sm text-red-900">
                        <span className="font-medium">{row.criterion}</span>
                        {" — "}
                        <span className="tabular-nums font-semibold">
                          −{computePointsLost(row.earned_points, row.max_points)} pt
                          {computePointsLost(row.earned_points, row.max_points) === 1 ? "" : "s"}
                        </span>
                        {row.justification ? (
                          <span className="block mt-0.5 text-red-800/90">{row.justification}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.rubricBreakdown && selected.rubricBreakdown.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Rubric breakdown
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-1 pr-2">Criterion</th>
                        <th className="pb-1 pr-2 w-16">Pts</th>
                        <th className="pb-1 pr-2 w-14">Lost</th>
                        <th className="pb-1">Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.rubricBreakdown.map((row, i) => {
                        const lost = computePointsLost(row.earned_points, row.max_points);
                        return (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1.5 pr-2 text-gray-800">{row.criterion}</td>
                            <td className="py-1.5 pr-2 tabular-nums">
                              <span className={row.earned ? "text-green-700" : "text-red-600"}>
                                {row.earned_points}/{row.max_points}
                              </span>
                            </td>
                            <td className="py-1.5 pr-2 tabular-nums">
                              {lost > 0 ? (
                                <span className="font-medium text-red-600">{lost}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="py-1.5 text-gray-600">{row.justification}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selected.improvements && selected.improvements.length > 0 && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
                    How to improve
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-amber-950">
                    {selected.improvements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.strengths && selected.strengths.length > 0 && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-900 mb-2">
                    Strengths
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-green-950">
                    {selected.strengths.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.feedback && (
                <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-gray-700">
                  {selected.feedback}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Your response
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap max-h-60 overflow-auto">
                  {stripHtml(selected.responseText) || "(empty)"}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 pb-8">
            {isPubliclyVisible && frqUploadId ? (
              <ExamShareButton
                examId={frqUploadId}
                examKind="frq"
                fullWidth={false}
                className="px-6 py-3 text-sm"
              />
            ) : null}
            <Link
              href="/dashboard/library?examKind=frq"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Library
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
