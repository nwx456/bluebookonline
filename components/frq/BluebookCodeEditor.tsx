"use client";

import { cn } from "@/lib/utils";

export interface BluebookCodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export function BluebookCodeEditor({
  value,
  onChange,
  className,
  disabled = false,
  label,
}: BluebookCodeEditorProps) {
  return (
    <div className={cn("flex flex-col border border-gray-300 bg-white", className)}>
      {label ? (
        <div className="border-b border-gray-200 bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-gray-600">
          {label}
        </div>
      ) : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={label ?? "Code response"}
        className={cn(
          "min-h-[240px] w-full resize-y border-0 bg-white px-3 py-3 font-mono text-sm leading-relaxed text-gray-900 outline-none",
          disabled && "cursor-default bg-gray-50 text-gray-800"
        )}
      />
    </div>
  );
}
