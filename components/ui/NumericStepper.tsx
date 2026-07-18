"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const displayId = useId();
  const safeValue = clampNumeric(value, min, max);
  const progress = max > min ? ((safeValue - min) / (max - min)) * 100 : 0;

  const decrement = () => {
    if (disabled || safeValue <= min) return;
    onChange(safeValue - 1);
  };

  const increment = () => {
    if (disabled || safeValue >= max) return;
    onChange(safeValue + 1);
  };

  const visiblePresets = presets.filter((p) => p >= min && p <= max);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={displayId} className={cn("text-sm font-medium text-gray-900", labelClassName)}>
          {label}
        </label>
        <div
          id={displayId}
          className="flex shrink-0 items-baseline gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5"
          role="spinbutton"
          aria-valuenow={safeValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={spinbuttonAriaLabel?.(safeValue) ?? `${label}: ${safeValue}`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "ArrowUp" || e.key === "+") {
              e.preventDefault();
              increment();
            }
            if (e.key === "ArrowDown" || e.key === "-") {
              e.preventDefault();
              decrement();
            }
          }}
        >
          <span className="text-lg font-semibold tabular-nums text-gray-900">{safeValue}</span>
          <span className="text-xs text-gray-500">{valueLabel}</span>
          {renderBadgeExtra?.(safeValue, max)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || safeValue <= min}
          onClick={decrement}
          aria-label={decrementAriaLabel}
          className="shrink-0 border-gray-200 text-gray-700"
        >
          <Minus />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-[width] duration-150"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-gray-500 tabular-nums">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled || safeValue >= max}
          onClick={increment}
          aria-label={incrementAriaLabel}
          className="shrink-0 border-gray-200 text-gray-700"
        >
          <Plus />
        </Button>
      </div>

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
