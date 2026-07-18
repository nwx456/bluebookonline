"use client";

import { cn } from "@/lib/utils";

export type UploadStep = {
  id: number;
  label: string;
};

type Props = {
  steps: readonly UploadStep[];
  activeStep: number;
};

export function UploadStepIndicator({ steps, activeStep }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isComplete = step.id < activeStep;
        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 && <span className="hidden h-px w-6 bg-gray-200 sm:block" aria-hidden />}
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                isComplete && "bg-blue-600 text-white",
                isActive && !isComplete && "bg-blue-100 text-blue-700 ring-2 ring-blue-600",
                !isActive && !isComplete && "bg-gray-100 text-gray-500"
              )}
            >
              {step.id}
            </span>
            <span
              className={cn(
                "text-xs font-medium sm:text-sm",
                isActive ? "text-gray-900" : "text-gray-500"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
