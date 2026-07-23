"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Users, GraduationCap, BookOpen, Settings, BarChart3, Search } from "lucide-react";
import { ClassCodeCopyButton } from "@/components/teacher/ClassCodeCopyButton";
import {
  institutionAuthHeaders,
  useInstitutionAuth,
} from "@/components/institution/InstitutionAuthProvider";

type Tab = "teachers" | "classes" | "students" | "analytics" | "settings";

type Overview = {
  totalTeachers: number;
  totalClasses: number;
  totalStudents: number;
};

type ClassSummaryRow = {
  classId: string;
  className: string;
  teacherEmail: string;
  teacherName: string;
  studentCount: number;
  assignmentCount: number;
  completionRate: number;
  averagePercentage: number | null;
};

type AssignmentAnalyticsRow = {
  assignmentId: string;
  classId: string;
  className: string;
  title: string;
  kind: "exam" | "frq_exam";
  assignedBy: string;
  assignedByName: string;
  dueAt: string | null;
  memberCount: number;
  completedCount: number;
  lateCount: number;
  completionRate: number;
  averagePercentage: number | null;
};

type StudentAnalyticsRow = {
  email: string;
  username: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  averagePercentage: number | null;
};

type TeacherAnalyticsRow = {
  email: string;
  username: string;
  classCount: number;
  studentCount: number;
  assignmentCount: number;
  lastAssignedAt: string | null;
};

type TeacherRow = {
  email: string;
  username: string;
  status: "pending" | "active" | "removed";
  requestedAt: string;
  approvedAt: string | null;
};

type ClassRow = {
  id: string;
  name: string;
  teacherEmail: string;
  teacherName: string;
  memberCount: number;
};

type StudentRow = {
  email: string;
  username: string;
  classCount: number;
  classNames: string[];
};

function formatPercent(value: number | null): string {
  return value != null ? `${value}%` : "—";
}

function formatKind(kind: "exam" | "frq_exam"): string {
  return kind === "frq_exam" ? "FRQ" : "MCQ";
}

function completionBadge(rate: number) {
  const styles =
    rate >= 80
      ? "bg-green-100 text-green-800"
      : rate >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${styles}`}>
      {rate}%
    </span>
  );
}

function resultCountBadge(filtered: number, total: number, label: string) {
  const text =
    filtered === total
      ? `${total} ${label}${total !== 1 ? "s" : ""}`
      : `${filtered} / ${total} ${label}${total !== 1 ? "s" : ""}`;
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {text}
    </span>
  );
}

function AnalyticsSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    active: "bg-green-100 text-green-800",
    removed: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

export default function InstitutionDashboardPage() {
  const { accessToken, institutionName, joinCode, refreshProfile } = useInstitutionAuth();
  const [tab, setTab] = useState<Tab>("teachers");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reassignClassId, setReassignClassId] = useState<string | null>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [resettingCode, setResettingCode] = useState(false);
  const [displayJoinCode, setDisplayJoinCode] = useState(joinCode);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [classSummaries, setClassSummaries] = useState<ClassSummaryRow[]>([]);
  const [assignmentAnalytics, setAssignmentAnalytics] = useState<AssignmentAnalyticsRow[]>([]);
  const [studentAnalytics, setStudentAnalytics] = useState<StudentAnalyticsRow[]>([]);
  const [teacherAnalytics, setTeacherAnalytics] = useState<TeacherAnalyticsRow[]>([]);
  const [analyticsClassFilter, setAnalyticsClassFilter] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");

  useEffect(() => {
    setDisplayJoinCode(joinCode);
  }, [joinCode]);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === "active"),
    [teachers]
  );

  const loadAll = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = institutionAuthHeaders(accessToken);
      const [overviewRes, teachersRes, classesRes, studentsRes] = await Promise.all([
        fetch("/api/institution/overview", { headers }),
        fetch("/api/institution/teachers", { headers }),
        fetch("/api/institution/classes", { headers }),
        fetch("/api/institution/students", { headers }),
      ]);

      const [overviewData, teachersData, classesData, studentsData] = await Promise.all([
        overviewRes.json(),
        teachersRes.json(),
        classesRes.json(),
        studentsRes.json(),
      ]);

      if (!overviewRes.ok) throw new Error(overviewData.error ?? "Could not load overview.");
      if (!teachersRes.ok) throw new Error(teachersData.error ?? "Could not load teachers.");
      if (!classesRes.ok) throw new Error(classesData.error ?? "Could not load classes.");
      if (!studentsRes.ok) throw new Error(studentsData.error ?? "Could not load students.");

      setOverview(overviewData.overview ?? null);
      setTeachers(teachersData.teachers ?? []);
      setClasses(classesData.classes ?? []);
      setStudents(studentsData.students ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadAnalytics = useCallback(async () => {
    if (!accessToken) return;
    setAnalyticsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/analytics", {
        headers: institutionAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load analytics.");
      setClassSummaries(data.classSummaries ?? []);
      setAssignmentAnalytics(data.assignments ?? []);
      setStudentAnalytics(data.studentSummaries ?? []);
      setTeacherAnalytics(data.teacherSummaries ?? []);
      setAnalyticsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (tab === "analytics" && !analyticsLoaded && !analyticsLoading) {
      loadAnalytics();
    }
  }, [tab, analyticsLoaded, analyticsLoading, loadAnalytics]);

  const filteredAssignments = useMemo(() => {
    if (analyticsClassFilter === "all") return assignmentAnalytics;
    return assignmentAnalytics.filter((a) => a.classId === analyticsClassFilter);
  }, [assignmentAnalytics, analyticsClassFilter]);

  const filteredStudentAnalytics = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return studentAnalytics;
    return studentAnalytics.filter(
      (s) =>
        s.username.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query)
    );
  }, [studentAnalytics, studentSearch]);

  const filteredTeacherAnalytics = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return teacherAnalytics;
    return teacherAnalytics.filter(
      (t) =>
        t.username.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query)
    );
  }, [teacherAnalytics, teacherSearch]);

  const handleTeacherAction = async (email: string, action: "approve" | "reject" | "remove") => {
    if (!accessToken) return;
    setActionLoading(`${action}:${email}`);
    try {
      const res = await fetch(
        `/api/institution/teachers/${encodeURIComponent(email)}/${action}`,
        {
          method: "POST",
          headers: institutionAuthHeaders(accessToken),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReassign = async (classId: string) => {
    if (!accessToken || !reassignEmail) return;
    setActionLoading(`reassign:${classId}`);
    try {
      const res = await fetch("/api/institution/classes", {
        method: "PATCH",
        headers: {
          ...institutionAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classId, teacherEmail: reassignEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reassign teacher.");
      setReassignClassId(null);
      setReassignEmail("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reassign teacher.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetJoinCode = async () => {
    if (!accessToken) return;
    setResettingCode(true);
    setError(null);
    try {
      const res = await fetch("/api/institution/join-code/reset", {
        method: "POST",
        headers: institutionAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reset join code.");
      setDisplayJoinCode(data.joinCode ?? "");
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset join code.");
    } finally {
      setResettingCode(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "teachers", label: "Teachers", icon: Users },
    { id: "classes", label: "Classes", icon: BookOpen },
    { id: "students", label: "Students", icon: GraduationCap },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (loading && !overview) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{institutionName}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage teachers, classes, and students across your organization.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Teachers</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {overview?.totalTeachers ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Classes</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {overview?.totalClasses ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {overview?.totalStudents ?? 0}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
              tab === id
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "teachers" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No teachers yet. Share your join code with teachers.
                  </td>
                </tr>
              ) : (
                teachers.map((t) => (
                  <tr key={t.email} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{t.username}</p>
                      <p className="text-xs text-gray-500">{t.email}</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(t.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {t.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoading === `approve:${t.email}`}
                              onClick={() => handleTeacherAction(t.email, "approve")}
                              className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading === `reject:${t.email}`}
                              onClick={() => handleTeacherAction(t.email, "reject")}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {t.status === "active" && (
                          <button
                            type="button"
                            disabled={actionLoading === `remove:${t.email}`}
                            onClick={() => handleTeacherAction(t.email, "remove")}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "classes" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No institution classes yet.
                  </td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <p>{c.teacherName}</p>
                      <p className="text-xs text-gray-500">{c.teacherEmail}</p>
                    </td>
                    <td className="px-4 py-3">{c.memberCount}</td>
                    <td className="px-4 py-3">
                      {reassignClassId === c.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={reassignEmail}
                            onChange={(e) => setReassignEmail(e.target.value)}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                          >
                            <option value="">Select teacher…</option>
                            {activeTeachers.map((t) => (
                              <option key={t.email} value={t.email}>
                                {t.username} ({t.email})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!reassignEmail || actionLoading === `reassign:${c.id}`}
                            onClick={() => handleReassign(c.id)}
                            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReassignClassId(null);
                              setReassignEmail("");
                            }}
                            className="text-xs text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReassignClassId(c.id);
                            setReassignEmail(c.teacherEmail);
                          }}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Reassign Teacher
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "students" && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Classes</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                    No students enrolled in institution classes yet.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.email} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.username}</p>
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.classCount} class{s.classCount !== 1 ? "es" : ""}:{" "}
                      {s.classNames.join(", ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading && !analyticsLoaded ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading analytics…
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Class Performance</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Average scores and assignment completion across institution classes.
                </p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Teacher</th>
                        <th className="px-4 py-3">Students</th>
                        <th className="px-4 py-3">Assignments</th>
                        <th className="px-4 py-3">Completion</th>
                        <th className="px-4 py-3">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No class performance data yet.
                          </td>
                        </tr>
                      ) : (
                        classSummaries.map((c) => (
                          <tr key={c.classId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{c.className}</td>
                            <td className="px-4 py-3">
                              <p>{c.teacherName}</p>
                              <p className="text-xs text-gray-500">{c.teacherEmail}</p>
                            </td>
                            <td className="px-4 py-3 tabular-nums">{c.studentCount}</td>
                            <td className="px-4 py-3 tabular-nums">{c.assignmentCount}</td>
                            <td className="px-4 py-3">{completionBadge(c.completionRate)}</td>
                            <td className="px-4 py-3 tabular-nums">{formatPercent(c.averagePercentage)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Track completion and scores for teacher-assigned exams.
                    </p>
                  </div>
                  <select
                    value={analyticsClassFilter}
                    onChange={(e) => setAnalyticsClassFilter(e.target.value)}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  >
                    <option value="all">All classes</option>
                    {classSummaries.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.className}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Assignment</th>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Completed</th>
                        <th className="px-4 py-3">Late</th>
                        <th className="px-4 py-3">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No assignments found for this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAssignments.map((a) => (
                          <tr key={a.assignmentId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{a.title}</p>
                              <p className="text-xs text-gray-500">{a.assignedByName}</p>
                              <p className="text-xs text-gray-400">{a.assignedBy}</p>
                            </td>
                            <td className="px-4 py-3">{a.className}</td>
                            <td className="px-4 py-3">{formatKind(a.kind)}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {a.completedCount}/{a.memberCount}{" "}
                              {completionBadge(a.completionRate)}
                            </td>
                            <td className="px-4 py-3 tabular-nums">{a.lateCount}</td>
                            <td className="px-4 py-3 tabular-nums">{formatPercent(a.averagePercentage)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">Teacher Performance</h2>
                      {resultCountBadge(
                        filteredTeacherAnalytics.length,
                        teacherAnalytics.length,
                        "teacher"
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      How many assignments each teacher has given across institution classes.
                    </p>
                  </div>
                  <AnalyticsSearchInput
                    value={teacherSearch}
                    onChange={setTeacherSearch}
                    placeholder="Search by name or email…"
                  />
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Teacher</th>
                        <th className="px-4 py-3">Classes</th>
                        <th className="px-4 py-3">Students</th>
                        <th className="px-4 py-3">Assignments Given</th>
                        <th className="px-4 py-3">Last Assignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeacherAnalytics.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            {teacherSearch.trim()
                              ? `No results for "${teacherSearch.trim()}".`
                              : "No teacher performance data yet."}
                          </td>
                        </tr>
                      ) : (
                        filteredTeacherAnalytics.map((t) => (
                          <tr key={t.email} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{t.username}</p>
                              <p className="text-xs text-gray-500">{t.email}</p>
                            </td>
                            <td className="px-4 py-3 tabular-nums">{t.classCount}</td>
                            <td className="px-4 py-3 tabular-nums">{t.studentCount}</td>
                            <td
                              className={`px-4 py-3 tabular-nums ${
                                t.assignmentCount === 0 ? "text-gray-400" : "text-gray-900"
                              }`}
                            >
                              {t.assignmentCount}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {t.lastAssignedAt
                                ? new Date(t.lastAssignedAt).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">Student Performance</h2>
                      {resultCountBadge(
                        filteredStudentAnalytics.length,
                        studentAnalytics.length,
                        "student"
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Institution-wide assignment completion and average scores per student.
                    </p>
                  </div>
                  <AnalyticsSearchInput
                    value={studentSearch}
                    onChange={setStudentSearch}
                    placeholder="Search by name or email…"
                  />
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Assigned</th>
                        <th className="px-4 py-3">Completed</th>
                        <th className="px-4 py-3">Completion</th>
                        <th className="px-4 py-3">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudentAnalytics.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            {studentSearch.trim()
                              ? `No results for "${studentSearch.trim()}".`
                              : "No student performance data yet."}
                          </td>
                        </tr>
                      ) : (
                        filteredStudentAnalytics.map((s) => (
                          <tr key={s.email} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{s.username}</p>
                              <p className="text-xs text-gray-500">{s.email}</p>
                            </td>
                            <td className="px-4 py-3 tabular-nums">{s.assignedCount}</td>
                            <td className="px-4 py-3 tabular-nums">{s.completedCount}</td>
                            <td className="px-4 py-3">{completionBadge(s.completionRate)}</td>
                            <td className="px-4 py-3 tabular-nums">{formatPercent(s.averagePercentage)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Institution Join Code</h2>
          <p className="mt-1 text-sm text-gray-600">
            Teachers use this code to request membership. Resetting the code does not affect
            existing memberships.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="rounded bg-gray-100 px-3 py-2 font-mono text-lg tracking-widest">
              {displayJoinCode || "—"}
            </code>
            {displayJoinCode && <ClassCodeCopyButton code={displayJoinCode} />}
            <button
              type="button"
              onClick={handleResetJoinCode}
              disabled={resettingCode}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {resettingCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reset Join Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
