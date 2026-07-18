"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_RESOURCE_MB = 50;
const MAX_RESOURCE_BYTES = MAX_RESOURCE_MB * 1024 * 1024;

const RESOURCE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

type ResourceFilePickerProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ResourceFilePicker({
  file,
  onFileChange,
  disabled = false,
}: ResourceFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyFile = (next: File | null) => {
    if (next && next.size > MAX_RESOURCE_BYTES) return;
    onFileChange(next);
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
    if (disabled) return;
    applyFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFile(e.target.files?.[0] ?? null);
  };

  const clearFile = () => {
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          disabled && "pointer-events-none opacity-60",
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
          accept={RESOURCE_ACCEPT}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Upload className="mx-auto h-7 w-7 text-gray-400" />
        <p className="mt-2 text-xs font-medium text-gray-700">
          Drag and drop a file, or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">Max {MAX_RESOURCE_MB} MB</p>
      </div>

      {file && (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
            {file.name}
          </span>
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
    </div>
  );
}
