"use client";

import { BarChart3, CheckCircle, CircleDashed, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModuleDisplayNumber, type SatModuleGroup } from "@/lib/sat-question-display";
import type { SatModuleId } from "@/lib/exam-program";

export type ModuleScoreBreakdownRow = {
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
};

export type ModuleScoreResult = {
  moduleId: SatModuleId;
  moduleLabel: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  notGradedCount: number;
  skipAiGrading: boolean;
  percentage: number;
  breakdown: ModuleScoreBreakdownRow[];
};

type Props = {
  result: ModuleScoreResult;
  moduleGroup: SatModuleGroup | null;
  onContinue: () => void;
  onStay: () => void;
  hasNextModule: boolean;
};

export function SatModuleResultOverlay({
  result,
  moduleGroup,
  onContinue,
  onStay,
  hasNextModule,
}: Props) {
  const r = result;
  const groupQuestions = moduleGroup?.questions ?? [];
  const totalInModule = groupQuestions.length || r.breakdown.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{r.moduleLabel}</h2>
          <p className="text-sm text-gray-600 mt-0.5">Module preview — your exam is still in progress</p>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600">Module score</p>
            <p className="mt-1 text-4xl font-bold text-indigo-700">{r.percentage}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {r.correctCount} correct of {r.correctCount + r.incorrectCount} answered
              {r.unansweredCount > 0 ? ` · ${r.unansweredCount} unanswered` : ""}
            </p>
          </div>

          <div
            className={cn(
              "grid grid-cols-2 gap-3 mb-4",
              r.notGradedCount > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"
            )}
          >
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <CheckCircle className="h-6 w-6 mx-auto text-green-600 mb-1" />
              <p className="text-xl font-bold text-green-700">{r.correctCount}</p>
              <p className="text-[11px] font-medium text-green-600">Correct</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
              <XCircle className="h-6 w-6 mx-auto text-red-600 mb-1" />
              <p className="text-xl font-bold text-red-700">{r.incorrectCount}</p>
              <p className="text-[11px] font-medium text-red-600">Incorrect</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
              <CircleDashed className="h-6 w-6 mx-auto text-gray-500 mb-1" />
              <p className="text-xl font-bold text-gray-600">{r.unansweredCount}</p>
              <p className="text-[11px] font-medium text-gray-500">Unanswered</p>
            </div>
            {r.notGradedCount > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <CircleDashed className="h-6 w-6 mx-auto text-amber-600 mb-1" />
                <p className="text-xl font-bold text-amber-800">{r.notGradedCount}</p>
                <p className="text-[11px] font-medium text-amber-700">Not graded</p>
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "mb-4 rounded-lg border px-3 py-2 text-xs",
              r.skipAiGrading
                ? "border-slate-200 bg-slate-50 text-slate-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {r.skipAiGrading ? (
              <>
                <strong>Note:</strong> Scored with answer keys only. Questions without a key were not graded.
              </>
            ) : (
              <>
                <strong>Note:</strong> AI may have been used for missing keys. This preview is not your final SAT
                score.
              </>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 text-sm">Question details</h3>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                {totalInModule} questions
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-700">#</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Your Answer</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Correct</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(moduleGroup?.questions ?? []).map((gq) => {
                    const row = r.breakdown.find((b) => b.questionNumber === gq.question_number);
                    if (!row) return null;
                    const hasUser =
                      row.userAnswer != null && String(row.userAnswer).trim() !== "";
                    const hasKey =
                      row.correctAnswer != null && String(row.correctAnswer).trim() !== "";
                    const status = !hasUser
                      ? "unanswered"
                      : !hasKey
                        ? "not_graded"
                        : row.isCorrect
                          ? "correct"
                          : "incorrect";
                    const displayNum = getModuleDisplayNumber(groupQuestions, gq);
                    return (
                      <tr key={row.questionNumber} className="border-b border-gray-100">
                        <td className="px-4 py-2 font-medium text-gray-900">{displayNum}</td>
                        <td className="px-4 py-2">{row.userAnswer ?? "—"}</td>
                        <td className="px-4 py-2">{row.correctAnswer ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              status === "correct" && "bg-green-100 text-green-800",
                              status === "incorrect" && "bg-red-100 text-red-800",
                              status === "unanswered" && "bg-gray-100 text-gray-600",
                              status === "not_graded" && "bg-amber-100 text-amber-900"
                            )}
                          >
                            {status === "correct"
                              ? "Correct"
                              : status === "incorrect"
                                ? "Incorrect"
                                : status === "unanswered"
                                  ? "Unanswered"
                                  : "Not graded"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!moduleGroup?.questions.length &&
                    r.breakdown.map((row) => {
                      const hasUser =
                        row.userAnswer != null && String(row.userAnswer).trim() !== "";
                      const hasKey =
                        row.correctAnswer != null && String(row.correctAnswer).trim() !== "";
                      const status = !hasUser
                        ? "unanswered"
                        : !hasKey
                          ? "not_graded"
                          : row.isCorrect
                            ? "correct"
                            : "incorrect";
                      return (
                        <tr key={row.questionNumber} className="border-b border-gray-100">
                          <td className="px-4 py-2 font-medium text-gray-900">{row.questionNumber}</td>
                          <td className="px-4 py-2">{row.userAnswer ?? "—"}</td>
                          <td className="px-4 py-2">{row.correctAnswer ?? "—"}</td>
                          <td className="px-4 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                status === "correct" && "bg-green-100 text-green-800",
                                status === "incorrect" && "bg-red-100 text-red-800",
                                status === "unanswered" && "bg-gray-100 text-gray-600",
                                status === "not_graded" && "bg-amber-100 text-amber-900"
                              )}
                            >
                              {status === "correct"
                                ? "Correct"
                                : status === "incorrect"
                                  ? "Incorrect"
                                  : status === "unanswered"
                                    ? "Unanswered"
                                    : "Not graded"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex flex-col sm:flex-row gap-2 justify-end">
          <button
            type="button"
            onClick={onStay}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Stay on this module
          </button>
          {hasNextModule ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Continue to next module
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
