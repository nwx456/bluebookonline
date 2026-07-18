"use client";

import { NumericStepper } from "@/components/ui/NumericStepper";

const DEFAULT_MIN = 5;
const DEFAULT_MAX = 30;
const DEFAULT_PRESETS = [5, 10, 15, 20, 25, 30];

export type QuestionCountSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  presets?: number[];
  disabled?: boolean;
};

export function QuestionCountSelector({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  presets = DEFAULT_PRESETS,
  disabled = false,
}: QuestionCountSelectorProps) {
  return (
    <NumericStepper
      label="Number of questions"
      valueLabel="questions"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      presets={presets}
      disabled={disabled}
      labelClassName="text-xs font-medium text-gray-700"
      decrementAriaLabel="Decrease question count"
      incrementAriaLabel="Increase question count"
      spinbuttonAriaLabel={(v) => `Number of questions: ${v}`}
    />
  );
}
