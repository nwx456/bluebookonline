"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampNumeric } from "@/components/ui/NumericStepper";

export type ScoreRangeSliderProps = {
  id?: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  showMinMax?: boolean;
};

export function ScoreRangeSlider({
  id,
  value,
  min = 0,
  max,
  onChange,
  disabled = false,
  ariaLabel,
  decrementAriaLabel = "Decrease value",
  incrementAriaLabel = "Increase value",
  showMinMax = false,
}: ScoreRangeSliderProps) {
  const safeValue = clampNumeric(Math.round(value), min, max);
  const progress = max > min ? ((safeValue - min) / (max - min)) * 100 : 0;

  const decrement = () => {
    if (disabled || safeValue <= min) return;
    onChange(safeValue - 1);
  };

  const increment = () => {
    if (disabled || safeValue >= max) return;
    onChange(safeValue + 1);
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || safeValue <= min}
          onClick={decrement}
          aria-label={decrementAriaLabel}
          className="h-9 w-9 shrink-0 rounded-full border-gray-200 text-gray-700"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="score-range-slider-wrap min-w-0 flex-1">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={1}
            value={safeValue}
            disabled={disabled}
            onChange={(e) => onChange(clampNumeric(Number(e.target.value), min, max))}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={safeValue}
            aria-label={ariaLabel}
            className="score-range-slider w-full"
            style={
              {
                "--slider-progress": `${progress}%`,
              } as React.CSSProperties
            }
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || safeValue >= max}
          onClick={increment}
          aria-label={incrementAriaLabel}
          className="h-9 w-9 shrink-0 rounded-full border-gray-200 text-gray-700"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showMinMax && (
        <div className="mt-1 flex justify-between px-12 text-[11px] text-gray-500 tabular-nums">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}
