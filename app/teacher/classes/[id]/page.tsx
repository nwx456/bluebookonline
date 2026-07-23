"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Loader2,
  UserMinus,
  Users,
} from "lucide-react";
import { InstitutionBadge } from "@/components/institution/InstitutionBadge";
import { ClassCodeCopyButton } from "@/components/teacher/ClassCodeCopyButton";
import { AssignContentPicker } from "@/components/teacher/AssignContentPicker";
import { TeacherAssignmentRow } from "@/components/teacher/TeacherAssignmentRow";
import type { AssignKind } from "@/components/teacher/assign-content-types";
import {
  teacherAuthHeaders,
  useTeacherAuth,
} from "@/components/teacher/TeacherAuthProvider";
import type {
  AssignmentContentMeta,
  TeacherClassAssignment,
} from "@/lib/teacher-assignment-content";
import { cn } from "@/lib/utils";

type Tab = "roster" | "assignments" | "analytics";

type Member = { email: string; username: string; joinedAt: string };

type AnalyticsRow = {
  assignmentId: string;
  title: string;
  dueAt: string | null;
  memberCount: number;
  completedCount: number;
  lateCount: number;
  averagePercentage: number | null;
  students: Array<{
    email: string;
    username: string;
    completed: boolean;
    percentage: number | null;
    isLate: boolean;
  }>;
};

export default function TeacherClassDetailPage() {
  const params = useParams();
  const classId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useTeacherAuth();
  const [tab, setTab] = useState<Tab>("roster");
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [isIndependent, setIsIndependent] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadClass = useCallback(async () => {
    if (!accessToken || !classId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`, {
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load class.");
      setClassName(data.class?.name ?? "");
      setClassCode(data.class?.classCode ?? "");
      setInstitutionName(data.class?.institutionName ?? null);
      setIsIndependent(data.class?.isIndependent ?? true);
      setMembers(data.members ?? []);
      setAssignments(data.assignments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load class.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, classId]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken || !classId) return;
    const res = await fetch(`/api/teacher/classes/${classId}/analytics`, {
      headers: teacherAuthHeaders(accessToken),
    });
    const data = await res.json();
    if (res.ok) setAnalytics(data.analytics ?? []);
  }, [accessToken, classId]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  useEffect(() => {
    if (tab === "analytics") loadAnalytics();
  }, [tab, loadAnalytics]);

  const handleAssign = async (payload: {
    kind: AssignKind;
    uploadId?: string;
    frqUploadId?: string;
    resourceId?: string;
    dueAt?: string;
  }) => {
    if (!accessToken) return;
    setAssigning(true);
    try {
      const body =
        payload.kind === "exam"
          ? { kind: "exam", uploadId: payload.uploadId, dueAt: payload.dueAt }
          : payload.kind === "frq_exam"
            ? { kind: "frq_exam", frqUploadId: payload.frqUploadId, dueAt: payload.dueAt }
            : { kind: "resource", resourceId: payload.resourceId };
      const res = await fetch(`/api/teacher/classes/${classId}/assignments`, {
        method: "POST",
        headers: {
          ...teacherAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign.");
      setShowAssign(false);
      await loadClass();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign.");
    } finally {
      setAssigning(false);
    }
  };

  const removeMember = async (email: string) => {
    if (!accessToken || !confirm("Remove this student from the class?")) return;
    const res = await fetch(
      `/api/teacher/classes/${classId}/members/${encodeURIComponent(email)}`,
      { method: "DELETE", headers: teacherAuthHeaders(accessToken) }
    );
    if (res.ok) await loadClass();
  };

  const handleAssignmentContentUpdated = (
    assignmentId: string,
    content: AssignmentContentMeta
  ) => {
    setAssignments((prev) =>
      prev.map((item) => (item.id === assignmentId ? { ...item, content } : item))
    );
  };

  const handleAssignmentRemoved = (assignmentId: string) => {
    setAssignments((prev) => prev.filter((item) => item.id !== assignmentId));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading class…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/teacher" className="text-sm text-blue-600 hover:text-blue-700">
          ← Back to classes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{className}</h1>
          <InstitutionBadge institutionName={isIndependent ? null : institutionName} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>Class code:</span>
          <code className="rounded bg-gray-100 px-2 py-0.5 font-mono">{classCode}</code>
          <ClassCodeCopyButton code={classCode} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            { id: "roster" as const, label: "Roster", shortLabel: "Roster", icon: Users },
            { id: "assignments" as const, label: "Assignments", shortLabel: "Assign", icon: ClipboardList },
            { id: "analytics" as const, label: "Analytics", shortLabel: "Stats", icon: BarChart3 },
          ] as const
        ).map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 text-sm font-medium sm:gap-1.5 sm:px-3",
              tab === id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-medium text-gray-900">{members.length} students</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-gray-500">
                No students yet. Share the class code so students can join.
              </li>
            ) : (
              members.map((m) => (
                <li key={m.email} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{m.username}</p>
                    <p className="truncate text-xs text-gray-500">{m.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(m.email)}
                    className="inline-flex shrink-0 items-center gap-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {tab === "assignments" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Assign Content
            </button>
          </div>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
              {assignments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">No assignments yet.</p>
              ) : (
                assignments.map((a) =>
                  accessToken ? (
                    <TeacherAssignmentRow
                      key={a.id}
                      assignment={a}
                      classId={classId}
                      accessToken={accessToken}
                      onRemoved={handleAssignmentRemoved}
                      onContentUpdated={handleAssignmentContentUpdated}
                      onError={setError}
                    />
                  ) : null
                )
              )}
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          {analytics.length === 0 ? (
            <p className="text-sm text-gray-500">No exam assignments to analyze yet.</p>
          ) : (
            analytics.map((row) => (
              <div key={row.assignmentId} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h3 className="font-medium text-gray-900">{row.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {row.completedCount}/{row.memberCount} completed
                    {row.lateCount > 0 ? ` · ${row.lateCount} late` : ""}
                    {row.averagePercentage != null ? ` · Avg ${row.averagePercentage}%` : ""}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                        <th className="px-5 py-2">Student</th>
                        <th className="px-5 py-2">Status</th>
                        <th className="px-5 py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.students.map((s) => (
                        <tr key={s.email} className="border-b border-gray-50">
                          <td className="px-5 py-2">{s.username}</td>
                          <td className="px-5 py-2">
                            {s.completed ? (
                              <span className={s.isLate ? "text-amber-700" : "text-green-700"}>
                                {s.isLate ? "Late" : "Completed"}
                              </span>
                            ) : (
                              <span className="text-gray-400">Not started</span>
                            )}
                          </td>
                          <td className="px-5 py-2">
                            {s.percentage != null ? `${s.percentage}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showAssign && accessToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Assign Content</h2>
            <div className="mt-4">
              <AssignContentPicker
                classId={classId}
                accessToken={accessToken}
                assigning={assigning}
                onAssign={handleAssign}
                onClose={() => setShowAssign(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
