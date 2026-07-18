"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { cn } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "error";

interface ClassCodeCopyButtonProps {
  code: string;
  className?: string;
}

export function ClassCodeCopyButton({ code, className }: ClassCodeCopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const ok = await copyTextToClipboard(code);
      setStatus(ok ? "copied" : "error");

      if (resetTimerRef.current != null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        setStatus("idle");
        resetTimerRef.current = null;
      }, 2000);
    },
    [code]
  );

  const label =
    status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy code";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium transition-colors",
        status === "copied" && "text-green-700",
        status === "error" && "text-red-600",
        status === "idle" && "text-blue-600 hover:text-blue-700",
        className
      )}
      aria-label={status === "copied" ? "Class code copied" : "Copy class code"}
      aria-live="polite"
    >
      {status === "copied" ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
