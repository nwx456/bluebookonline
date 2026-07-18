"use client";

import { useCallback, useEffect, useState } from "react";
import type { LibraryAttemptItem, LibraryUploadItem } from "@/lib/library-types";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import {
  patchAttemptLibraryFields,
  patchFrqAttemptLibraryFields,
  patchFrqUploadLibraryFields,
  patchUploadLibraryFields,
} from "@/components/library/useLibraryTags";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { useProgram } from "@/lib/use-program";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { estimateApScore } from "@/lib/ap-score-estimate";
import { ArchiveRestore } from "lucide-react";

export default function DashboardArchivedPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const [uploads, setUploads] = useState<LibraryUploadItem[]>([]);
  const [attempts, setAttempts] = useState<LibraryAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadArchived = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ archived: "true", program });
      const headers = libraryAuthHeaders(accessToken);
      const [uploadsRes, attemptsRes] = await Promise.all([
        fetch(`/api/library/uploads?${params.toString()}`, { headers }),
        fetch(`/api/library/attempts?${params.toString()}`, { headers }),
      ]);
      const uploadsData = await uploadsRes.json();
      const attemptsData = await attemptsRes.json();
      if (uploadsRes.ok) setUploads(uploadsData.uploads ?? []);
      if (attemptsRes.ok) setAttempts(attemptsData.attempts ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken, program]);

  useEffect(() => {
    void loadArchived();
  }, [loadArchived]);

  const restoreUpload = async (exam: LibraryUploadItem) => {
    if (!accessToken) return;
    setBusyId(exam.id);
    try {
      if (exam.examKind === "frq") {
        await patchFrqUploadLibraryFields(accessToken, exam.id, { archived: false });
      } else {
        await patchUploadLibraryFields(accessToken, exam.id, { archived: false });
      }
      await loadArchived();
    } finally {
      setBusyId(null);
    }
  };

  const restoreAttempt = async (attempt: LibraryAttemptItem) => {
    if (!accessToken) return;
    setBusyId(attempt.id);
    try {
      if (attempt.examKind === "frq") {
        await patchFrqAttemptLibraryFields(accessToken, attempt.id, { archived: false });
      } else {
        await patchAttemptLibraryFields(accessToken, attempt.id, { archived: false });
      }
      await loadArchived();
    } finally {
      setBusyId(null);
    }
  };

  const empty = !loading && uploads.length === 0 && attempts.length === 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Archived</h1>
        <p className="mt-1 text-sm text-gray-600">
          Exams and attempts you archived. Restore anything to bring it back to your active{" "}
          {program} library.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading archive…</p>
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">Nothing archived yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {uploads.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Exams
              </h2>
              <div className="space-y-2">
                {uploads.map((exam) => (
                  <article
                    key={exam.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{exam.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {exam.examKind === "frq"
                          ? getFrqCourseLabel(exam.subject)
                          : SUBJECT_LABELS[exam.subject as SubjectKey] ?? exam.subject}
                        {exam.examKind === "frq" ? " · FRQ" : ""}
                        {" · "}
                        {exam.questionCount} questions
                        {" · "}
                        Uploaded {new Date(exam.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === exam.id}
                      onClick={() => void restoreUpload(exam)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Restore
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {attempts.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Attempts
              </h2>
              <div className="space-y-2">
                {attempts.map((attempt) => (
                  <article
                    key={attempt.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {attempt.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {attempt.examKind === "frq"
                          ? getFrqCourseLabel(attempt.subject)
                          : SUBJECT_LABELS[attempt.subject as SubjectKey] ?? attempt.subject}
                        {attempt.examKind === "frq" ? " · FRQ" : ""}
                        {" · "}
                        {new Date(attempt.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm font-semibold tabular-nums text-gray-900">
                        {attempt.examKind === "frq" ? (
                          <>
                            {attempt.totalScore ?? 0}/{attempt.maxScore ?? 0} pts
                            <span className="ml-1 text-xs font-normal text-gray-500">
                              ({attempt.percentage ?? 0}%)
                            </span>
                          </>
                        ) : attempt.examProgram === "SAT"
                          ? (attempt.totalScaledScore ??
                            attempt.rwScaledScore ??
                            attempt.mathScaledScore ??
                            "—")
                          : attempt.percentage != null
                            ? `${attempt.percentage}% (est. ${estimateApScore(attempt.percentage) ?? "—"})`
                            : "—"}
                      </div>
                      <button
                        type="button"
                        disabled={busyId === attempt.id}
                        onClick={() => void restoreAttempt(attempt)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
