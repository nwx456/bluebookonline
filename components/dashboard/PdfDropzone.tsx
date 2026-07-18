"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PDF_UPLOAD_MB } from "@/lib/pdf-upload-limits";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type Props = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  variant?: "hero" | "compact";
  title: string;
  description: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function PdfDropzone({
  file,
  onFileChange,
  disabled = false,
  variant = "hero",
  title,
  description,
  inputRef: externalRef,
}: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped?.type === "application/pdf") {
      onFileChange(dropped);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files?.[0] ?? null);
  };

  const clearFile = () => {
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isHero = variant === "hero";

  return (
    <div className="space-y-2">
      <div>
        <p className={cn("font-medium text-gray-900", isHero ? "text-sm" : "text-xs")}>{title}</p>
        <p className={cn("text-gray-500", isHero ? "text-xs mt-0.5" : "text-xs")}>{description}</p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed text-center transition-colors",
          isHero ? "p-10" : "p-6",
          disabled && "opacity-60 pointer-events-none",
          isDragging
            ? "border-blue-600 bg-blue-600/5"
            : file
              ? "border-blue-300 bg-blue-50/30"
              : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className={cn("mx-auto text-gray-400", isHero ? "h-10 w-10" : "h-7 w-7")} />
        <p className={cn("mt-2 font-medium text-gray-700", isHero ? "text-sm" : "text-xs")}>
          {isHero ? description : "Drag and drop a PDF, or click to browse"}
        </p>
        {isHero && (
          <p className="mt-1 text-xs text-gray-500">PDF only · Max {MAX_PDF_UPLOAD_MB} MB</p>
        )}
      </div>

      {file && (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{file.name}</span>
          <span className="shrink-0 text-xs text-gray-500">{formatFileSize(file.size)}</span>
          <button
            type="button"
            onClick={clearFile}
            disabled={disabled}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isHero && !file && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>Only PDF format is accepted. Maximum file size is {MAX_PDF_UPLOAD_MB} MB.</span>
        </div>
      )}
    </div>
  );
}
