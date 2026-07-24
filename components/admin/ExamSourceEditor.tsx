"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { ExamSourceLine } from "@/components/exams/ExamSourceLine";
import {
  EXAM_SOURCE_TYPE_LABELS,
  validateExamSource,
  type ExamSourceType,
} from "@/lib/exam-source";
import { examHasSource } from "@/lib/exam-source-admin";
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
  /** Shown in the modal header for context (exam filename/title). */
  examLabel?: string;
  /** API namespace for saving source (admin PDFs vs moderator exam approval). */
  apiScope?: "admin" | "moderator";
};

export function ExamSourceEditor({
  examId,
  examKind,
  accessToken,
  initialValues,
  disabled = false,
  onSaved,
  compact = false,
  examLabel,
  apiScope = "admin",
}: ExamSourceEditorProps) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<ExamSourceType | "">(
    initialValues.sourceType ?? ""
  );
  const [sourceName, setSourceName] = useState(initialValues.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialValues.sourceUrl ?? "");
  const [sourceUrlCheck, setSourceUrlCheck] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [sourceUrlCheckError, setSourceUrlCheckError] = useState("");
  const [, setNotOfficialConfirmed] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedValues, setSavedValues] = useState(initialValues);

  const resetForm = useCallback(() => {
    setSourceType(initialValues.sourceType ?? "");
    setSourceName(initialValues.sourceName ?? "");
    setSourceUrl(initialValues.sourceUrl ?? "");
    setNotOfficialConfirmed(true);
    setSourceUrlCheck("idle");
    setSourceUrlCheckError("");
    setSaveError(null);
  }, [initialValues]);

  useEffect(() => {
    setSavedValues(initialValues);
    if (!open) {
      resetForm();
    }
  }, [initialValues, open, resetForm]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving]);

  const sourceValidation = useMemo(() => {
    if (!sourceType) return { ok: false as const, error: "Select a source type." };
    return validateExamSource({
      sourceType,
      sourceName,
      sourceUrl: sourceType === "school" ? undefined : sourceUrl,
    });
  }, [sourceType, sourceName, sourceUrl]);

  const sourceUrlReadyToVerify = useMemo(() => {
    if (sourceType !== "book" && sourceType !== "agency") return false;
    const probe = validateExamSource({
      sourceType,
      sourceName: "x",
      sourceUrl,
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
    if (!open || sourceType === "school") {
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
  }, [open, sourceType, sourceUrl, sourceUrlReadyToVerify, accessToken]);

  const handleSave = useCallback(async () => {
    if (!canSave || !sourceValidation.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const kindParam = examKind === "frq" ? "?examKind=frq" : "";
      const apiBase =
        apiScope === "moderator" ? "/api/moderator/exams" : "/api/admin/exams";
      const res = await fetch(`${apiBase}/${examId}/source${kindParam}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceType: sourceValidation.normalized.sourceType,
          sourceName: sourceValidation.normalized.sourceName,
          sourceUrl: sourceValidation.normalized.sourceUrl ?? undefined,
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
    apiScope,
  ]);

  const hasSource = examHasSource({
    sourceType: savedValues.sourceType,
    sourceName: savedValues.sourceName,
  });

  if (disabled) {
    return (
      <div className={cn("text-xs text-gray-400", compact && "max-w-[220px]")}>
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
    <>
      <div className={cn("space-y-1.5", compact && "max-w-[220px]")}>
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
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {hasSource ? (
            <>
              <Pencil className="h-3 w-3" aria-hidden />
              Edit source
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" aria-hidden />
              Add source
            </>
          )}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`exam-source-title-${examId}`}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={`exam-source-title-${examId}`}
                  className="text-base font-semibold text-gray-900"
                >
                  {hasSource ? "Edit exam source" : "Add exam source"}
                </h2>
                {examLabel ? (
                  <p className="mt-0.5 truncate text-sm text-gray-500" title={examLabel}>
                    {examLabel}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-gray-600">
                  Tell users where this exam comes from. Required before approval.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-3">
                <fieldset>
                  <legend className="text-sm font-medium text-gray-900">Source type</legend>
                  <div className="mt-2 space-y-2">
                    {(Object.keys(EXAM_SOURCE_TYPE_LABELS) as ExamSourceType[]).map((type) => (
                      <label
                        key={type}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
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
                            setSourceUrlCheck("idle");
                            setSourceUrlCheckError("");
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-gray-800">{EXAM_SOURCE_TYPE_LABELS[type]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {sourceType && sourceType !== "school" ? (
                  <div className="space-y-4 border-t border-gray-100 pt-4">
                    <div>
                      <label
                        htmlFor={`sourceName-${examId}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {sourceType === "book" ? "Book title" : "Agency name"}
                        <span className="text-red-600"> *</span>
                      </label>
                      <input
                        id={`sourceName-${examId}`}
                        type="text"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        maxLength={200}
                        placeholder={
                          sourceType === "book"
                            ? "e.g. Barron's AP US History"
                            : "e.g. Princeton Review"
                        }
                        className="mt-1.5 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`sourceUrl-${examId}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Source URL
                        <span className="text-red-600"> *</span>
                      </label>
                      <input
                        id={`sourceUrl-${examId}`}
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => {
                          setSourceUrl(e.target.value);
                          setSourceUrlCheck("idle");
                          setSourceUrlCheckError("");
                        }}
                        placeholder="https://publisher or agency website"
                        className="mt-1.5 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                      {sourceUrlCheck === "checking" ? (
                        <p className="mt-1.5 text-sm text-gray-500">Checking link…</p>
                      ) : sourceUrlCheck === "valid" ? (
                        <p className="mt-1.5 text-sm text-green-700">Link verified</p>
                      ) : sourceUrlCheck === "invalid" && sourceUrlCheckError ? (
                        <p className="mt-1.5 text-sm text-red-600">{sourceUrlCheckError}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!sourceValidation.ok && sourceType ? (
                  <p className="text-sm text-amber-700">{sourceValidation.error}</p>
                ) : null}
                {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => void handleSave()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save source
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
