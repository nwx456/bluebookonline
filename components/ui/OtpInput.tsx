"use client";

import { useRef, useState, useCallback, KeyboardEvent } from "react";

const LENGTH = 4;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  "aria-label"?: string;
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  error = false,
  "aria-label": ariaLabel = "Verification code",
}: OtpInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(LENGTH, " ").split("").slice(0, LENGTH);

  const notify = useCallback(
    (newDigits: string[]) => {
      const str = newDigits.join("").replace(/\s/g, "").slice(0, LENGTH);
      onChange(str);
    },
    [onChange]
  );

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;
    const newDigits = [...digits];
    if (char.length === 0) {
      newDigits[index] = " ";
    } else if (char.length === 1) {
      newDigits[index] = char;
      if (index < LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      const rest = char.slice(1).split("").slice(0, LENGTH - index);
      rest.forEach((c, i) => {
        if (index + i < LENGTH) newDigits[index + i] = c;
      });
      const nextFocus = Math.min(index + rest.length, LENGTH - 1);
      inputRefs.current[nextFocus]?.focus();
    }
    notify(newDigits);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = " ";
      notify(newDigits);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    const newDigits = [...digits];
    pasted.split("").forEach((c, i) => {
      if (i < LENGTH) newDigits[i] = c;
    });
    notify(newDigits);
    const next = Math.min(pasted.length, LENGTH - 1);
    inputRefs.current[next]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label={ariaLabel}>
      {Array.from({ length: LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={index === 0 ? LENGTH : 1}
          autoComplete="one-time-code"
          value={digits[index]?.trim() ?? ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(null)}
          disabled={disabled}
          className={`
            w-12 h-12 text-center text-lg font-semibold rounded-md border bg-[var(--card-bg)]
            transition-colors outline-none
            ${error ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-[var(--border)] focus:border-blue-600 focus:ring-1 focus:ring-blue-600"}
            ${focusedIndex === index ? "ring-1 ring-blue-600 border-blue-600" : ""}
          `}
          aria-label={`${ariaLabel} digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
