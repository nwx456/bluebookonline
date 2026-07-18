"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_NOTES_FILE_BYTES,
  MAX_NOTES_FILE_MB,
  MAX_NOTES_FILES,
} from "@/lib/notes-upload-limits";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  variant?: "hero" | "compact";
  title: string;
  description: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onValidationError?: (message: string | null) => void;
};

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const map = new Map<string, File>();
  for (const file of existing) map.set(`${file.name}:${file.size}`, file);
  for (const file of incoming) map.set(`${file.name}:${file.size}`, file);
  return Array.from(map.values()).slice(0, MAX_NOTES_FILES);
}

function isAllowedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt");
}

export function NotesDropzone({
  files,
  onFilesChange,
  disabled = false,
  variant = "hero",
  title,
  description,
  inputRef: externalRef,
  onValidationError,
}: Props) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: FileList | File[] | null | undefined) => {
    if (!incoming || disabled) return;
    const list = Array.from(incoming).filter(isAllowedFile);
    if (list.length === 0) {
      onValidationError?.("Only PDF, DOCX, or TXT files are supported.");
      return;
    }

    const oversized = list.filter((file) => file.size > MAX_NOTES_FILE_BYTES);
    if (oversized.length > 0) {
      onValidationError?.(
        `"${oversized[0].name}" exceeds the ${MAX_NOTES_FILE_MB} MB limit per file.`
      );
      return;
    }

    onValidationError?.(null);
    onFilesChange(mergeFiles(files, list));
  };

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
    addFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files ?? undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    onFilesChange([]);
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
            : files.length > 0
              ? "border-blue-300 bg-blue-50/30"
              : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleInputChange}
          disabled={disabled || files.length >= MAX_NOTES_FILES}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className={cn("mx-auto text-gray-400", isHero ? "h-10 w-10" : "h-7 w-7")} />
        <p className={cn("mt-2 font-medium text-gray-700", isHero ? "text-sm" : "text-xs")}>
          {files.length >= MAX_NOTES_FILES
            ? `Maximum ${MAX_NOTES_FILES} files reached`
            : isHero
              ? description
              : "Drag and drop notes, or click to browse"}
        </p>
        {isHero && (
          <p className="mt-1 text-xs text-gray-500">
            PDF, DOCX, or TXT · Up to {MAX_NOTES_FILES} files · Max {MAX_NOTES_FILE_MB} MB each
          </p>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-gray-500">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={clearFiles}
            disabled={disabled}
            className="text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            Clear all files
          </button>
        </div>
      )}

      {isHero && files.length === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Upload your class notes (.pdf, .docx, .txt). We will generate an original AP-style
            practice exam from them.
          </span>
        </div>
      )}
    </div>
  );
}
