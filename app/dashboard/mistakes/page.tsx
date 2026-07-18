"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { getExamProgram } from "@/lib/exam-program";
import { useProgram } from "@/lib/use-program";

interface WrongAnswerRow {
  uploadId: string;
  attemptId: string;
  attemptTitle?: string | null;
  filename: string;
  subject: string;
  completedAt: string;
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string | null;
  questionText: string | null;
}

export default function DashboardMistakesPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const [rows, setRows] = useState<WrongAnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attemptFilter, setAttemptFilter] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    const params = new URLSearchParams({ all: "true" });
    if (attemptFilter) params.set("attemptId", attemptFilter);
    fetch(`/api/exams/wrong-answers?${params.toString()}`, {
      headers: libraryAuthHeaders(accessToken),
    })
      .then((r) => r.json())
      .then((data) => setRows(data.wrongAnswers ?? []))
      .finally(() => setLoading(false));
  }, [accessToken, attemptFilter]);

  const filtered = useMemo(() => {
    return rows.filter((row) => getExamProgram(row.subject as SubjectKey) === program);
  }, [rows, program]);

  const attemptOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const row of filtered) {
      if (!map.has(row.attemptId)) {
        map.set(row.attemptId, {
          id: row.attemptId,
          label: row.attemptTitle?.trim() || row.filename,
        });
      }
    }
    return [...map.values()];
  }, [filtered]);

  const visibleRows = attemptFilter
    ? filtered.filter((row) => row.attemptId === attemptFilter)
    : filtered;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Mistakes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review wrong answers across attempts and jump back into focused review mode.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={attemptFilter}
          onChange={(e) => setAttemptFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All attempts</option>
          {attemptOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {attemptFilter && (
          <Link
            href={`/exam/${visibleRows[0]?.uploadId}?attempt=${attemptFilter}&wrongOnly=1`}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Eye className="h-4 w-4" />
            Review mistakes only
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading mistakes…</p>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">No wrong answers to review yet. Great work.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Exam</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Q#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Your answer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Correct</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((row) => (
                  <tr key={`${row.attemptId}-${row.questionNumber}`} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 line-clamp-1">
                        {row.attemptTitle?.trim() || row.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {SUBJECT_LABELS[row.subject as SubjectKey] ?? row.subject}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.questionNumber}</td>
                    <td className="px-4 py-3">{row.userAnswer ?? "—"}</td>
                    <td className="px-4 py-3">{row.correctAnswer ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/exam/${row.uploadId}?attempt=${row.attemptId}&question=${row.questionNumber}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
