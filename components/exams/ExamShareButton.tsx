"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { cn } from "@/lib/utils";

interface ExamShareButtonProps {
  examId: string;
  examKind?: "mcq" | "frq";
  fullWidth?: boolean;
  className?: string;
}

type ShareStatus = "idle" | "copied" | "error";

export function ExamShareButton({
  examId,
  examKind = "mcq",
  fullWidth = true,
  className,
}: ExamShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleShare = useCallback(async () => {
    const path = examKind === "frq" ? `/frq/${examId}` : `/exam/${examId}`;
    const url = `${window.location.origin}${path}`;
    const ok = await copyTextToClipboard(url);
    setStatus(ok ? "copied" : "error");

    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setStatus("idle");
      resetTimerRef.current = null;
    }, 2500);
  }, [examId, examKind]);

  const label =
    status === "copied" ? "Link copied!" : status === "error" ? "Copy failed" : "Share";

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        status === "copied" &&
          "border-green-200 bg-green-50 text-green-800 hover:bg-green-50",
        status === "error" &&
          "border-red-200 bg-red-50 text-red-800 hover:bg-red-50",
        status === "idle" &&
          "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
        fullWidth && "w-full",
        className
      )}
      aria-label={status === "copied" ? "Link copied to clipboard" : "Share exam link"}
      aria-live="polite"
    >
      {status === "copied" ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
