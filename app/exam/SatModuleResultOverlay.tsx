"use client";

import { cn } from "@/lib/utils";
import { getModuleDisplayNumber, type SatModuleGroup } from "@/lib/sat-question-display";
import type { SatModuleId } from "@/lib/exam-program";
import { SatScoreReportCard } from "@/app/exam/components/SatScoreReportCard";
import { ExamAttemptStatsStrip } from "@/app/exam/components/ExamAttemptStatsStrip";

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto safe-area-bottom">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-4">
          <SatScoreReportCard
            subject="SAT_FULL_TEST"
            sat={{
              isFullTest: false,
              rwScaled: null,
              mathScaled: null,
              totalScaled: null,
            }}
            modulePreview={{
              label: r.moduleLabel,
              correctCount: r.correctCount,
              totalCount: totalInModule,
              percentage: r.percentage,
            }}
          />

          <ExamAttemptStatsStrip
            correctCount={r.correctCount}
            incorrectCount={r.incorrectCount}
            unansweredCount={r.unansweredCount}
            notGradedCount={r.notGradedCount}
            total={totalInModule}
            compact
          />

          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs",
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
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 text-sm">Question details</h3>
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

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 safe-area-bottom sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onStay}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Stay on this module
          </button>
          {hasNextModule ? (
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              Continue to next module
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
