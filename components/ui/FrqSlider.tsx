"use client";

import { ScoreRangeSlider } from "@/components/ui/ScoreRangeSlider";
import { clampNumeric } from "@/components/ui/NumericStepper";

export type FrqSliderProps = {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function FrqSlider({ id, label, value, max, onChange, disabled = false }: FrqSliderProps) {
  const safeValue = clampNumeric(Math.round(value), 0, max);

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-gray-900 leading-snug">
          {label}
        </label>
        <div className="flex shrink-0 items-baseline gap-0.5 tabular-nums">
          <span className="text-lg font-bold text-gray-900">{safeValue}</span>
          <span className="text-sm text-gray-400">/ {max}</span>
        </div>
      </div>

      <ScoreRangeSlider
        id={id}
        value={safeValue}
        min={0}
        max={max}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={`${label}: ${safeValue} of ${max} points`}
        decrementAriaLabel={`Decrease ${label} score`}
        incrementAriaLabel={`Increase ${label} score`}
      />
    </div>
  );
}
