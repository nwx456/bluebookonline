"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Archive, BookOpen, Clock, Play, Trash2, Upload, XCircle } from "lucide-react";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import { useProgram } from "@/lib/use-program";
import type { LibrarySummary } from "@/lib/library-types";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { attemptReviewHref } from "@/lib/library-entity-utils";
import { estimateApScore } from "@/lib/ap-score-estimate";

export default function DashboardOverviewPage() {
  const { accessToken, userDisplayName } = useDashboardAuth();
  const { program } = useProgram();
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/library/summary?program=${program}`, {
      headers: libraryAuthHeaders(accessToken),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error((data.error as string) ?? "Could not load dashboard summary.");
        }
        setSummary(data.summary ?? null);
      })
      .catch((err) => {
        setSummary(null);
        setLoadError(err instanceof Error ? err.message : "Could not load dashboard summary.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, program]);

  const archivedTotal =
    summary != null ? summary.archivedUploads + summary.archivedAttempts : 0;

  const handleDiscard = async (attemptId: string) => {
    if (!accessToken) return;
    if (!confirm("Discard this in-progress exam? Saved answers will be removed.")) return;
    setDeletingId(attemptId);
    try {
      await fetch(`/api/exam/attempt/${attemptId}`, {
        method: "DELETE",
        headers: libraryAuthHeaders(accessToken),
      });
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              inProgress: Math.max(0, prev.inProgress - 1),
              inProgressAttempts: prev.inProgressAttempts.filter((a) => a.id !== attemptId),
            }
          : prev
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {userDisplayName}. Track progress and jump back into practice.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload a new exam</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              Turn a PDF into a practice test with AI analysis. Your {program} library updates
              automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Upload exam
            </Link>
            <Link
              href="/dashboard/library"
              className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Browse library
            </Link>
          </div>
        </div>
      </section>

      {loadError && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{loadError}</p>
        </div>
      )}

      {archivedTotal > 0 && (
        <Link
          href="/dashboard/archived"
          className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <Archive className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">{archivedTotal}</span> item
            {archivedTotal === 1 ? "" : "s"} in archive — view or restore
          </span>
        </Link>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/library"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-200"
        >
          <BookOpen className="h-5 w-5 text-blue-600" />
          <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
            {loading ? "—" : (summary?.activeUploads ?? 0)}
          </p>
          <p className="text-sm text-gray-600">Exams in library</p>
        </Link>
        <Link
          href="/dashboard/history"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-200"
        >
          <Clock className="h-5 w-5 text-blue-600" />
          <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
            {loading ? "—" : (summary?.activeAttempts ?? 0)}
          </p>
          <p className="text-sm text-gray-600">Completed attempts</p>
        </Link>
        <Link
          href="/dashboard/mistakes"
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-amber-200"
        >
          <XCircle className="h-5 w-5 text-amber-600" />
          <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
            {loading ? "—" : (summary?.mistakeCount ?? 0)}
          </p>
          <p className="text-sm text-gray-600">Wrong answers to review</p>
        </Link>
      </div>

      {(summary?.inProgressAttempts.length ?? 0) > 0 && (
        <section className="mb-8 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">Continuing exams</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {summary!.inProgressAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{attempt.filename}</p>
                  <p className="text-xs text-gray-500">
                    {SUBJECT_LABELS[attempt.subject as SubjectKey] ?? attempt.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/exam/${attempt.uploadId}?resume=${attempt.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Continue
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === attempt.id}
                    onClick={() => void handleDiscard(attempt.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Recent attempts</h2>
          <Link href="/dashboard/history" className="text-xs font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {!loading && (summary?.recentAttempts.length ?? 0) === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            No completed attempts yet. Start an exam from your{" "}
            <Link href="/dashboard/library" className="text-blue-600 hover:underline">
              library
            </Link>
            .
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(summary?.recentAttempts ?? []).map((attempt) => {
              const subjectLabel =
                attempt.examKind === "frq"
                  ? getFrqCourseLabel(attempt.subject)
                  : SUBJECT_LABELS[attempt.subject as SubjectKey] ?? attempt.subject;
              const reviewHref = attemptReviewHref({
                id: attempt.id,
                uploadId: attempt.uploadId,
                examKind: attempt.examKind ?? "mcq",
              });

              return (
              <div
                key={attempt.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{attempt.title}</p>
                  <p className="text-xs text-gray-500">
                    {subjectLabel}
                    {attempt.examKind === "frq" ? " · FRQ" : ""}
                    {" · "}
                    {new Date(attempt.completedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {attempt.examKind === "frq" ? (
                      <p className="text-lg font-bold tabular-nums text-gray-900">
                        {attempt.totalScore ?? 0}
                        <span className="text-sm font-normal text-gray-500">
                          {" "}/ {attempt.maxScore ?? 0} pts
                        </span>
                        <span className="ml-1 text-xs font-normal text-gray-500">
                          ({attempt.percentage ?? 0}%)
                        </span>
                      </p>
                    ) : attempt.examProgram === "SAT" ? (
                      <p className="text-lg font-bold tabular-nums text-gray-900">
                        {attempt.totalScaledScore ??
                          attempt.rwScaledScore ??
                          attempt.mathScaledScore ??
                          "—"}
                      </p>
                    ) : (
                      <p className="text-lg font-bold tabular-nums text-gray-900">
                        {attempt.percentage ?? "—"}%
                        <span className="ml-1 text-xs font-normal text-gray-500">
                          est. {estimateApScore(attempt.percentage) ?? "—"}
                        </span>
                      </p>
                    )}
                  </div>
                  <Link
                    href={reviewHref}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Review
                  </Link>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
