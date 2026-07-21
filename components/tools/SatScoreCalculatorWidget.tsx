"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FrqSlider } from "@/components/ui/FrqSlider";
import {
  defaultSatM2Variants,
  defaultSatModuleScores,
  SAT_CALCULATOR_MODULES,
} from "@/lib/sat-score-calculator-data";
import {
  computeSatScores,
  estimateSatTotalPercentile,
  SAT_SCORE_CALCULATOR_DISCLAIMER,
  type SatModule2Variant,
} from "@/lib/sat-scoring";
import { cn } from "@/lib/utils";

function M2Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SatModule2Variant;
  onChange: (v: SatModule2Variant) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-xs font-medium text-gray-600">{label} Module 2 path</span>
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {(["easy", "hard"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
              value === opt ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SatScoreCalculatorWidget() {
  const [moduleScores, setModuleScores] = useState(defaultSatModuleScores);
  const [m2Variants, setM2Variants] = useState(defaultSatM2Variants);

  const scores = useMemo(
    () =>
      computeSatScores({
        rwM1: moduleScores.rwM1 ?? 0,
        rwM2: moduleScores.rwM2 ?? 0,
        mathM1: moduleScores.mathM1 ?? 0,
        mathM2: moduleScores.mathM2 ?? 0,
        rwM2Variant: m2Variants.rw,
        mathM2Variant: m2Variants.math,
      }),
    [moduleScores, m2Variants],
  );

  const percentile = estimateSatTotalPercentile(scores.totalScaled);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Module scores
          </p>
          {SAT_CALCULATOR_MODULES.map((mod) => (
            <FrqSlider
              key={mod.id}
              id={mod.id}
              label={mod.label}
              value={moduleScores[mod.id] ?? 0}
              max={mod.max}
              onChange={(next) =>
                setModuleScores((prev) => ({
                  ...prev,
                  [mod.id]: next,
                }))
              }
            />
          ))}
          <M2Toggle
            label="Reading & Writing"
            value={m2Variants.rw}
            onChange={(rw) => setM2Variants((prev) => ({ ...prev, rw }))}
          />
          <M2Toggle
            label="Math"
            value={m2Variants.math}
            onChange={(math) => setM2Variants((prev) => ({ ...prev, math }))}
          />
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-gray-600">Estimated total score</p>
          <div className="mt-3 flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-4xl font-bold text-white">
            {scores.totalScaled}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            R&amp;W: <span className="font-semibold text-gray-900">{scores.rwScaled}</span>
            {" · "}
            Math: <span className="font-semibold text-gray-900">{scores.mathScaled}</span>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Approx. {percentile}
            {percentile === 1 ? "st" : percentile === 2 ? "nd" : percentile === 3 ? "rd" : "th"}{" "}
            percentile nationally
          </p>
          <p className="mt-3 text-xs text-gray-500 leading-relaxed max-w-xs">
            {SAT_SCORE_CALCULATOR_DISCLAIMER}
          </p>
          <Link
            href="/exams?program=sat"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Take a full Digital SAT practice test
          </Link>
        </div>
      </div>
    </div>
  );
}
