"use client";

import { cn } from "@/lib/utils";

export interface RubricRow {
  criterion: string;
  max_points: number;
  earned_points: number;
  earned: boolean;
  justification: string;
}

export function FrqScoreReportCard({
  courseLabel,
  title,
  totalScore,
  maxScore,
  completedAt,
  responses,
  className,
}: {
  courseLabel: string;
  title: string;
  totalScore: number;
  maxScore: number;
  completedAt?: string | null;
  responses: Array<{
    questionNumber: number;
    partLabel: string;
    score: number | null;
    maxPoints: number;
    feedback: string | null;
    rubricBreakdown: RubricRow[] | null;
    responseText: string;
  }>;
  className?: string;
}) {
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden", className)}>
      <div className="bg-[#1e3a5f] px-6 py-4 text-center text-white">
        <p className="text-lg font-medium">{courseLabel}</p>
        <p className="mt-1 text-sm text-white/75 truncate">{title}</p>
      </div>

      <div className="px-6 py-8 text-center">
        <p className="text-sm text-gray-500">Your Score</p>
        <p className="mt-2 text-4xl font-bold text-gray-900">
          {totalScore} <span className="text-2xl font-normal text-gray-500">/ {maxScore}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">{pct}%</p>
        {completedAt && (
          <p className="mt-3 text-xs text-gray-400">
            Completed {new Date(completedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="border-t border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Question Breakdown</h3>
        <div className="space-y-6">
          {responses.map((r) => (
            <div key={`${r.questionNumber}-${r.partLabel}`} className="rounded border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">
                  Question {r.questionNumber}
                  {r.partLabel ? ` — Part (${r.partLabel})` : ""}
                </p>
                <p className="text-sm font-semibold text-blue-700">
                  {r.score ?? 0} / {r.maxPoints} pts
                </p>
              </div>

              {r.rubricBreakdown && r.rubricBreakdown.length > 0 && (
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="pb-1 pr-2">Criterion</th>
                      <th className="pb-1 pr-2 w-16">Pts</th>
                      <th className="pb-1">Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.rubricBreakdown.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-gray-800">{row.criterion}</td>
                        <td className="py-1.5 pr-2">
                          <span className={row.earned ? "text-green-700" : "text-red-600"}>
                            {row.earned_points}/{row.max_points}
                          </span>
                        </td>
                        <td className="py-1.5 text-gray-600">{row.justification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {r.feedback && (
                <p className="text-sm text-gray-700 bg-blue-50 rounded p-2 mb-2">{r.feedback}</p>
              )}

              {r.responseText && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View your response</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-800 font-mono text-xs max-h-40 overflow-auto">
                    {r.responseText.replace(/<[^>]+>/g, " ").trim() || "(empty)"}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-400 text-center">
        Scored using AI based on College Board FRQ rubrics. This is practice feedback, not an official AP score.
      </div>
    </div>
  );
}
