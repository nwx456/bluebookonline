"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { ExamSourceLine } from "@/components/exams/ExamSourceLine";
import {
  EXAM_SOURCE_TYPE_LABELS,
  validateExamSource,
  type ExamSourceType,
} from "@/lib/exam-source";
import { cn } from "@/lib/utils";

export type ExamSourceEditorValues = {
  sourceType: ExamSourceType | null;
  sourceName: string | null;
  sourceUrl: string | null;
};

type ExamSourceEditorProps = {
  examId: string;
  examKind: "mcq" | "frq";
  accessToken: string;
  initialValues: ExamSourceEditorValues;
  disabled?: boolean;
  onSaved?: (values: ExamSourceEditorValues) => void;
  compact?: boolean;
};

export function ExamSourceEditor({
  examId,
  examKind,
  accessToken,
  initialValues,
  disabled = false,
  onSaved,
  compact = false,
}: ExamSourceEditorProps) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<ExamSourceType | "">(
    initialValues.sourceType ?? ""
  );
  const [sourceName, setSourceName] = useState(initialValues.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialValues.sourceUrl ?? "");
  const [notOfficialConfirmed, setNotOfficialConfirmed] = useState(true);
  const [sourceUrlCheck, setSourceUrlCheck] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [sourceUrlCheckError, setSourceUrlCheckError] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedValues, setSavedValues] = useState(initialValues);

  useEffect(() => {
    setSavedValues(initialValues);
    if (!open) {
      setSourceType(initialValues.sourceType ?? "");
      setSourceName(initialValues.sourceName ?? "");
      setSourceUrl(initialValues.sourceUrl ?? "");
    }
  }, [initialValues, open]);

  const sourceValidation = useMemo(() => {
    if (!sourceType) return { ok: false as const, error: "Select a source type." };
    return validateExamSource({
      sourceType,
      sourceName,
      sourceUrl: sourceType === "school" ? undefined : sourceUrl,
      notOfficialConfirmed,
    });
  }, [sourceType, sourceName, sourceUrl, notOfficialConfirmed]);

  const sourceUrlReadyToVerify = useMemo(() => {
    if (sourceType !== "book" && sourceType !== "agency") return false;
    const probe = validateExamSource({
      sourceType,
      sourceName: "x",
      sourceUrl,
      notOfficialConfirmed: true,
    });
    return probe.ok || !probe.error.toLowerCase().includes("url");
  }, [sourceType, sourceUrl]);

  const isSourceUrlReachable =
    sourceType === "school" || sourceUrlCheck === "valid";

  const canSave =
    sourceValidation.ok &&
    isSourceUrlReachable &&
    !saving &&
    !disabled &&
    sourceUrlCheck !== "checking";

  useEffect(() => {
    if (sourceType === "school") {
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      return;
    }
    if (!sourceUrlReadyToVerify || !accessToken) {
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      return;
    }

    const timer = window.setTimeout(() => {
      setSourceUrlCheck("checking");
      fetch("/api/upload/verify-source-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sourceUrl }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (data.ok === true) {
            setSourceUrlCheck("valid");
            setSourceUrlCheckError("");
          } else {
            setSourceUrlCheck("invalid");
            setSourceUrlCheckError(
              typeof data.error === "string"
                ? data.error
                : "This source URL could not be verified."
            );
          }
        })
        .catch(() => {
          setSourceUrlCheck("invalid");
          setSourceUrlCheckError("Could not verify link. Try again.");
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [sourceType, sourceUrl, sourceUrlReadyToVerify, accessToken]);

  const handleSave = useCallback(async () => {
    if (!canSave || !sourceValidation.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const kindParam = examKind === "frq" ? "?examKind=frq" : "";
      const res = await fetch(`/api/admin/exams/${examId}/source${kindParam}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceType: sourceValidation.normalized.sourceType,
          sourceName: sourceValidation.normalized.sourceName,
          sourceUrl: sourceValidation.normalized.sourceUrl ?? undefined,
          notOfficialConfirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(typeof data.error === "string" ? data.error : "Could not save source.");
        return;
      }

      const nextValues: ExamSourceEditorValues = {
        sourceType: data.sourceType as ExamSourceType,
        sourceName: data.sourceName as string,
        sourceUrl: (data.sourceUrl as string | null) ?? null,
      };
      setSavedValues(nextValues);
      setOpen(false);
      onSaved?.(nextValues);
    } catch {
      setSaveError("Connection error.");
    } finally {
      setSaving(false);
    }
  }, [
    accessToken,
    canSave,
    examId,
    examKind,
    onSaved,
    sourceValidation,
  ]);

  const hasSource = Boolean(savedValues.sourceType && savedValues.sourceName);

  if (disabled) {
    return (
      <div className="text-xs text-gray-400">
        {hasSource ? (
          <ExamSourceLine
            sourceType={savedValues.sourceType}
            sourceName={savedValues.sourceName}
            sourceUrl={savedValues.sourceUrl}
            className="text-xs"
          />
        ) : (
          "Not eligible"
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", compact && "max-w-xs")}>
      <div className="flex flex-wrap items-center gap-2">
        {hasSource ? (
          <ExamSourceLine
            sourceType={savedValues.sourceType}
            sourceName={savedValues.sourceName}
            sourceUrl={savedValues.sourceUrl}
            className="text-xs"
          />
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Missing
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {hasSource ? "Edit source" : "Add source"}
        </button>
      </div>

      {open ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="space-y-2">
            {(Object.keys(EXAM_SOURCE_TYPE_LABELS) as ExamSourceType[]).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors",
                  sourceType === type
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name={`sourceType-${examId}`}
                  value={type}
                  checked={sourceType === type}
                  onChange={() => {
                    setSourceType(type);
                    if (type === "school") {
                      setSourceUrl("");
                      setSourceName("");
                    }
                  }}
                  className="mt-0.5"
                />
                <span className="text-gray-800">{EXAM_SOURCE_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>

          {sourceType && sourceType !== "school" ? (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  {sourceType === "book" ? "Book title" : "Agency name"}
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Source URL</label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    setSourceUrlCheck("idle");
                    setSourceUrlCheckError("");
                  }}
                  placeholder="https://"
                  className="mt-1 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {sourceUrlCheck === "checking" ? (
                  <p className="mt-1 text-xs text-gray-500">Checking link…</p>
                ) : sourceUrlCheck === "valid" ? (
                  <p className="mt-1 text-xs text-green-700">Link verified</p>
                ) : sourceUrlCheck === "invalid" && sourceUrlCheckError ? (
                  <p className="mt-1 text-xs text-red-600">{sourceUrlCheckError}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={notOfficialConfirmed}
              onChange={(e) => setNotOfficialConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>
              Confirmed: not official College Board, ACT, or Bluebook material.
            </span>
          </label>

          {!sourceValidation.ok && sourceType ? (
            <p className="text-xs text-amber-700">{sourceValidation.error}</p>
          ) : null}
          {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save source
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
