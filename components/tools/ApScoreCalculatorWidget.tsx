"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FrqSlider } from "@/components/ui/FrqSlider";
import { NumericStepper } from "@/components/ui/NumericStepper";
import {
  buildMcqPresets,
  compositeToApScore,
  computeCompositeScore,
  SCORE_CALCULATOR_DISCLAIMER,
  type ScoreCalculatorExam,
} from "@/lib/score-calculator-data";

interface ApScoreCalculatorWidgetProps {
  exam: ScoreCalculatorExam;
}

const SCORE_COLORS: Record<number, string> = {
  5: "bg-green-600 text-white",
  4: "bg-blue-600 text-white",
  3: "bg-yellow-500 text-gray-900",
  2: "bg-orange-500 text-white",
  1: "bg-red-600 text-white",
};

export function ApScoreCalculatorWidget({ exam }: ApScoreCalculatorWidgetProps) {
  const [mcqCorrect, setMcqCorrect] = useState(Math.floor(exam.mcqCount * 0.7));
  const [frqPoints, setFrqPoints] = useState<Record<string, number>>(() =>
    Object.fromEntries(exam.frqParts.map((p) => [p.id, Math.floor(p.maxPoints * 0.6)])),
  );

  const composite = useMemo(
    () => computeCompositeScore(exam, mcqCorrect, frqPoints),
    [exam, mcqCorrect, frqPoints],
  );
  const predicted = compositeToApScore(exam, composite);
  const pct = Math.round((composite / exam.maxComposite) * 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <NumericStepper
              label={`Multiple choice correct (${exam.mcqCount} questions)`}
              valueLabel="correct"
              value={mcqCorrect}
              onChange={setMcqCorrect}
              min={0}
              max={exam.mcqCount}
              presets={buildMcqPresets(exam.mcqCount)}
              decrementAriaLabel="Decrease MCQ correct count"
              incrementAriaLabel="Increase MCQ correct count"
              spinbuttonAriaLabel={(v) => {
                const pct = exam.mcqCount > 0 ? Math.round((v / exam.mcqCount) * 100) : 0;
                return `${v} of ${exam.mcqCount} multiple choice correct, ${pct} percent`;
              }}
              renderBadgeExtra={(v, max) =>
                max > 0 ? (
                  <span className="text-xs font-medium text-blue-600 tabular-nums">
                    · {Math.round((v / max) * 100)}%
                  </span>
                ) : null
              }
            />
            <p className="text-xs text-gray-500 mt-2">
              MCQ weight: {Math.round(exam.mcqWeight * 100)}% of composite
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">FRQ score</p>
            {exam.frqParts.map((part) => (
              <FrqSlider
                key={part.id}
                id={part.id}
                label={part.label}
                value={frqPoints[part.id] ?? 0}
                max={part.maxPoints}
                onChange={(next) =>
                  setFrqPoints((prev) => ({
                    ...prev,
                    [part.id]: next,
                  }))
                }
              />
            ))}
            <p className="text-xs text-gray-500">
              FRQ weight: {Math.round(exam.frqWeight * 100)}% of composite
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-gray-600">Predicted AP score</p>
          <div
            className={`mt-3 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold ${SCORE_COLORS[predicted]}`}
          >
            {predicted}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Composite: <span className="font-semibold text-gray-900">{composite}</span> /{" "}
            {exam.maxComposite} ({pct}%)
          </p>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed max-w-xs">
            {SCORE_CALCULATOR_DISCLAIMER}
          </p>
          <Link
            href={`/exams/${exam.examSlug}`}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Take a full-length {exam.shortName} practice test
          </Link>
        </div>
      </div>
    </div>
  );
}
