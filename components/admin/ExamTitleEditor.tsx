"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ExamTitleEditorProps = {
  examId: string;
  examKind: "mcq" | "frq";
  accessToken: string;
  displayName: string;
  storageFilename: string;
  displayTitle: string | null;
  onSaved?: (displayTitle: string | null, displayName: string) => void;
  compact?: boolean;
};

export function ExamTitleEditor({
  examId,
  examKind,
  accessToken,
  displayName,
  storageFilename,
  displayTitle,
  onSaved,
  compact = false,
}: ExamTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayTitle ?? displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setValue(displayTitle ?? displayName);
    }
  }, [displayTitle, displayName, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const kindParam = examKind === "frq" ? "?examKind=frq" : "";
      const res = await fetch(`/api/moderator/exams/${examId}/title${kindParam}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayTitle: value.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save title.");
        return;
      }
      const nextTitle = (data.displayTitle as string | null) ?? null;
      const nextDisplayName = nextTitle?.trim() || storageFilename;
      setEditing(false);
      onSaved?.(nextTitle, nextDisplayName);
    } catch {
      setError("Connection error.");
    } finally {
      setSaving(false);
    }
  }, [accessToken, examId, examKind, onSaved, storageFilename, value]);

  if (editing) {
    return (
      <div className={cn("space-y-1", compact && "max-w-[220px]")}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          placeholder="Display title"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setError(null);
              setValue(displayTitle ?? displayName);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", compact && "max-w-[220px]")}>
      <div className="flex items-start gap-1.5">
        <span className="min-w-0 truncate font-medium text-gray-900" title={displayName}>
          {displayName}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="Rename display title"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {storageFilename !== displayName ? (
        <p className="truncate text-[11px] text-gray-500" title={storageFilename}>
          File: {storageFilename}
        </p>
      ) : (
        <p className="truncate text-[11px] text-gray-500" title={storageFilename}>
          Original: {storageFilename}
        </p>
      )}
    </div>
  );
}
