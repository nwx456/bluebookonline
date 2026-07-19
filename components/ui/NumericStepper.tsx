"use client";

import { useId } from "react";
import { ScoreRangeSlider } from "@/components/ui/ScoreRangeSlider";
import { cn } from "@/lib/utils";

export function clampNumeric(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type NumericStepperProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  valueLabel: string;
  min?: number;
  max?: number;
  presets?: number[];
  showPresets?: boolean;
  disabled?: boolean;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  spinbuttonAriaLabel?: (value: number) => string;
  renderBadgeExtra?: (value: number, max: number) => React.ReactNode;
  labelClassName?: string;
};

export function NumericStepper({
  value,
  onChange,
  label,
  valueLabel,
  min = 0,
  max = 100,
  presets = [],
  showPresets = true,
  disabled = false,
  decrementAriaLabel = "Decrease value",
  incrementAriaLabel = "Increase value",
  spinbuttonAriaLabel,
  renderBadgeExtra,
  labelClassName,
}: NumericStepperProps) {
  const sliderId = useId();
  const safeValue = clampNumeric(value, min, max);

  const visiblePresets = presets.filter((p) => p >= min && p <= max);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={sliderId} className={cn("text-sm font-medium text-gray-900", labelClassName)}>
          {label}
        </label>
        <div
          className="flex shrink-0 items-baseline gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5"
          aria-hidden
        >
          <span className="text-lg font-semibold tabular-nums text-gray-900">{safeValue}</span>
          <span className="text-xs text-gray-500">{valueLabel}</span>
          {renderBadgeExtra?.(safeValue, max)}
        </div>
      </div>

      <ScoreRangeSlider
        id={sliderId}
        value={safeValue}
        min={min}
        max={max}
        onChange={onChange}
        disabled={disabled}
        showMinMax
        ariaLabel={spinbuttonAriaLabel?.(safeValue) ?? `${label}: ${safeValue}`}
        decrementAriaLabel={decrementAriaLabel}
        incrementAriaLabel={incrementAriaLabel}
      />

      {showPresets && visiblePresets.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Quick select
          </p>
          <div
            className={cn(
              "grid gap-2",
              visiblePresets.length <= 3 ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6",
            )}
          >
            {visiblePresets.map((preset) => {
              const selected = safeValue === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(clampNumeric(preset, min, max))}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-colors",
                    selected
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
