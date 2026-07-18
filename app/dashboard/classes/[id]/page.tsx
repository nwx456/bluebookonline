"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ExternalLink, Eye, Loader2, Play } from "lucide-react";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import {
  downloadResourceFile,
  fetchResourceDownload,
  viewResource,
} from "@/lib/open-resource";

type Classmate = { email: string; username: string; isSelf: boolean };
type Assignment = {
  id: string;
  kind: string;
  uploadId: string | null;
  frqUploadId: string | null;
  resourceId: string | null;
  title: string;
  resourceType: string | null;
  dueAt: string | null;
  attempt: {
    attemptId: string;
    completed: boolean;
    isLate: boolean;
    percentage: number | null;
  } | null;
  frqAttempt: {
    attemptId: string;
    completed: boolean;
    isLate: boolean;
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
  } | null;
};

export default function StudentClassDetailPage() {
  const params = useParams();
  const classId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useDashboardAuth();
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !classId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/student/classes/${classId}`, {
        headers: libraryAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load class.");
      setClassName(data.class?.name ?? "");
      setTeacherName(data.class?.teacherName ?? "");
      setClassmates(data.classmates ?? []);
      setAssignments(data.assignments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load class.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, classId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResourceView = async (resourceId: string, resourceType: string | null) => {
    if (!accessToken) return;
    try {
      if (resourceType === "link") {
        const data = await fetchResourceDownload(resourceId, libraryAuthHeaders(accessToken));
        if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }
      await viewResource(resourceId, libraryAuthHeaders(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open resource.");
    }
  };

  const handleResourceDownload = async (resourceId: string) => {
    if (!accessToken) return;
    try {
      await downloadResourceFile(resourceId, libraryAuthHeaders(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/classes" className="text-sm text-blue-600 hover:text-blue-700">
        ← Back to classes
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-gray-900">{className}</h1>
      <p className="text-sm text-gray-600">Teacher: {teacherName}</p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Classmates ({classmates.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {classmates.map((c) => (
            <span
              key={c.email}
              className={`rounded-full px-3 py-1 text-sm ${
                c.isSelf ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
              }`}
            >
              {c.username}
              {c.isSelf ? " (you)" : ""}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Assignments
        </h2>
        <div className="space-y-3">
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-500">No assignments yet.</p>
          ) : (
            assignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {a.kind === "resource" && a.resourceType
                      ? `${a.resourceType} resource`
                      : a.kind}
                    {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleString()}` : ""}
                    {a.attempt?.isLate ? " · Late submission" : ""}
                    {a.attempt?.completed && a.attempt.percentage != null
                      ? ` · Score ${a.attempt.percentage}%`
                      : ""}
                    {a.frqAttempt?.completed && a.frqAttempt.totalScore != null
                      ? ` · Score ${a.frqAttempt.totalScore}/${a.frqAttempt.maxScore} pts`
                      : ""}
                  </p>
                </div>
                <div>
                  {a.kind === "frq_exam" && a.frqUploadId && (
                    <Link
                      href={`/frq/${a.frqUploadId}?assignmentId=${a.id}${
                        a.frqAttempt?.completed ? `&reviewAttemptId=${a.frqAttempt.attemptId}` : ""
                      }`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      {a.frqAttempt?.completed ? "View Results" : "Solve"}
                    </Link>
                  )}
                  {a.kind === "exam" && a.uploadId && (
                    <Link
                      href={`/exam/${a.uploadId}?assignment=${a.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      {a.attempt?.completed ? "Retake" : "Solve"}
                    </Link>
                  )}
                  {a.kind === "resource" && a.resourceId && (
                    <div className="flex flex-wrap gap-2">
                      {a.resourceType === "link" ? (
                        <button
                          type="button"
                          onClick={() => handleResourceView(a.resourceId!, a.resourceType)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open link
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResourceView(a.resourceId!, a.resourceType)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResourceDownload(a.resourceId!)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
