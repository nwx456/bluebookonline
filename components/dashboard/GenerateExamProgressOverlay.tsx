"use client";

import { useEffect, useState } from "react";
import { Brain, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UploadAnalyzeProgress,
  type UploadAnalyzeProgressProps,
} from "@/components/UploadAnalyzeProgress";

const GENERATE_TIPS = [
  "Reading every topic in your notes…",
  "Balancing question difficulty across sub-topics…",
  "Writing original AP-style distractors…",
  "Saving answer explanations to your exam…",
];

export interface GenerateExamProgressOverlayProps extends UploadAnalyzeProgressProps {
  open: boolean;
  completeMessage?: string | null;
}

export function GenerateExamProgressOverlay({
  open,
  completeMessage,
  headline = "Building your practice exam…",
  subtitle,
  ...progressProps
}: GenerateExamProgressOverlayProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!open || completeMessage) return;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % GENERATE_TIPS.length);
    }, 8000);
    return () => clearInterval(id);
  }, [open, completeMessage]);

  useEffect(() => {
    if (!open) setTipIndex(0);
  }, [open]);

  if (!open) return null;

  const showSuccess = Boolean(completeMessage) && !progressProps.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-busy={showSuccess ? "false" : "true"}
      aria-labelledby="generate-progress-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              {showSuccess ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              ) : (
                <Sparkles className="h-5 w-5 animate-pulse" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p id="generate-progress-title" className="text-base font-semibold">
                {showSuccess ? "Your exam is ready" : "Creating your AP practice exam"}
              </p>
              <p className="mt-0.5 text-sm text-blue-100">
                {showSuccess
                  ? completeMessage
                  : "Please keep this tab open — generation usually takes 2–4 minutes."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {showSuccess ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-green-700">
              <Brain className="h-5 w-5" aria-hidden />
              Opening your exam…
            </div>
          ) : (
            <>
              <UploadAnalyzeProgress
                {...progressProps}
                headline={headline}
                subtitle={subtitle}
                className="mt-0 max-w-none border-0 p-0 shadow-none ring-0"
              />
              <p
                className={cn(
                  "mt-4 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-center text-xs text-blue-900 transition-opacity duration-500",
                  progressProps.error && "hidden"
                )}
                role="status"
                aria-live="polite"
              >
                {GENERATE_TIPS[tipIndex]}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
