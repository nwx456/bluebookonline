"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryExamKind } from "@/lib/library-types";
import { attemptReviewHref } from "@/lib/library-entity-utils";

interface AttemptShareButtonProps {
  uploadId: string;
  attemptId: string;
  title: string;
  examProgram: "AP" | "SAT";
  examKind?: LibraryExamKind;
  percentage: number | null;
  totalScaledScore: number | null;
  totalScore?: number | null;
  maxScore?: number | null;
  completedAt: string;
  isPublished?: boolean;
  className?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AttemptShareButton(props: AttemptShareButtonProps) {
  const {
    uploadId,
    attemptId,
    title,
    examProgram,
    examKind = "mcq",
    percentage,
    totalScaledScore,
    totalScore,
    maxScore,
    completedAt,
    isPublished = false,
    className,
  } = props;
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleShare = useCallback(async () => {
    const scoreLine =
      examKind === "frq"
        ? `FRQ score: ${totalScore ?? 0}/${maxScore ?? 0} pts (${percentage ?? "—"}%)`
        : examProgram === "SAT"
          ? `SAT score: ${totalScaledScore ?? "—"}`
          : `Score: ${percentage ?? "—"}%`;
    const reviewUrl = `${window.location.origin}${attemptReviewHref({
      id: attemptId,
      uploadId,
      examKind,
    })}`;
    const text = [
      `${title}`,
      scoreLine,
      `Completed: ${new Date(completedAt).toLocaleDateString()}`,
      `Review: ${reviewUrl}`,
      isPublished ? "" : "(Private exam — opens only when signed in to your account)",
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await copyText(text);
    setStatus(ok ? "copied" : "error");
    window.setTimeout(() => setStatus("idle"), 2500);
  }, [
    attemptId,
    completedAt,
    examKind,
    examProgram,
    isPublished,
    maxScore,
    percentage,
    title,
    totalScaledScore,
    totalScore,
    uploadId,
  ]);

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        status === "copied" && "border-green-200 bg-green-50 text-green-800",
        status === "error" && "border-red-200 bg-red-50 text-red-800",
        status === "idle" && "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
        className
      )}
    >
      {status === "copied" ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" /> Share
        </>
      )}
    </button>
  );
}
