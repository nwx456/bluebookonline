"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, X } from "lucide-react";
import type {
  AdminUserActivityPayload,
  AdminUserAttemptItem,
  AdminUserAttemptStatus,
} from "@/lib/admin-user-activity";
import { getInsightsSubjectLabel } from "@/lib/insights-subject-label";
import { QUESTION_REPORT_REASON_LABELS } from "@/lib/question-report-reasons";
import type { QuestionReportReasonCode } from "@/lib/question-report-reasons";
import { cn } from "@/lib/utils";

const ATTEMPTS_PAGE_SIZE = 50;

type PanelTab = "overview" | "exams" | "reports" | "classes" | "errors";

const TABS: { id: PanelTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "exams", label: "Exam Activity" },
  { id: "reports", label: "Question Reports" },
  { id: "classes", label: "Classes" },
  { id: "errors", label: "Error Logs" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "TEACHER":
      return "bg-purple-100 text-purple-800";
    case "STUDENT":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusBadgeClass(status: AdminUserAttemptStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800";
    case "abandoned":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function statusLabel(status: AdminUserAttemptStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "abandoned":
      return "Abandoned";
    default:
      return status;
  }
}

function formatScore(attempt: AdminUserAttemptItem): string {
  if (attempt.examProgram === "SAT" && attempt.totalScaledScore != null) {
    return String(attempt.totalScaledScore);
  }
  if (attempt.examKind === "frq" && attempt.totalScore != null && attempt.maxScore != null) {
    return `${attempt.totalScore}/${attempt.maxScore}`;
  }
  if (attempt.percentage != null) {
    return `${attempt.percentage}%`;
  }
  return "—";
}

function reasonLabels(codes: string[]): string {
  if (!codes.length) return "—";
  return codes
    .map((code) => QUESTION_REPORT_REASON_LABELS[code as QuestionReportReasonCode] ?? code)
    .join(", ");
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export function UserActivityPanel({
  email,
  accessToken,
  onClose,
}: {
  email: string;
  accessToken: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>("overview");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminUserActivityPayload | null>(null);

  const loadActivity = useCallback(
    async (offset: number, append: boolean) => {
      if (!accessToken) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams();
        params.set("email", email);
        params.set("attemptsLimit", String(ATTEMPTS_PAGE_SIZE));
        params.set("attemptsOffset", String(offset));

        const res = await fetch(`/api/admin/user-activity?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Failed to load user activity.");
          if (!append) setData(null);
          return;
        }

        const payload = json as AdminUserActivityPayload;
        if (append) {
          setData((prev) =>
            prev
              ? {
                  ...payload,
                  attempts: [...prev.attempts, ...payload.attempts],
                }
              : payload
          );
        } else {
          setData(payload);
        }
      } catch {
        setError("Connection error.");
        if (!append) setData(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, email]
  );

  useEffect(() => {
    setTab("overview");
    void loadActivity(0, false);
  }, [email, accessToken, loadActivity]);

  const handleLoadMore = () => {
    if (!data) return;
    void loadActivity(data.attempts.length, true);
  };

  const canLoadMore = data != null && data.attempts.length < data.attemptsTotal;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel backdrop"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-xl"
        aria-label="User activity panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            {loading && !data ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading user activity…
              </div>
            ) : data ? (
              <>
                <h2 className="truncate text-lg font-semibold text-gray-900">
                  {data.profile.username || data.profile.email.split("@")[0]}
                </h2>
                <p className="truncate font-mono text-xs text-gray-600">{data.profile.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      roleBadgeClass(data.profile.role)
                    )}
                  >
                    {data.profile.role}
                  </span>
                  <span className="text-xs text-gray-500">
                    Joined {formatDate(data.profile.createdAt)}
                  </span>
                  {data.profile.countryCode || data.profile.legalRegion ? (
                    <span className="text-xs text-gray-500">
                      · {data.profile.countryCode ?? data.profile.legalRegion}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <h2 className="text-lg font-semibold text-gray-900">{email}</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <p className="shrink-0 border-b border-gray-100 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6">
          Login sessions and IP addresses are not tracked. Location here refers to exam/subject
          context.
        </p>

        <nav
          className="shrink-0 overflow-x-auto border-b border-gray-200 px-2 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="User activity sections"
        >
          <div className="flex min-w-max gap-1 py-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                  tab === id
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {loading && !data ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
            </div>
          ) : null}

          {data && tab === "overview" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <KpiCard label="Total attempts" value={data.summary.totalAttempts} />
                <KpiCard label="Completed" value={data.summary.completedAttempts} />
                <KpiCard label="In progress" value={data.summary.inProgressAttempts} />
                <KpiCard
                  label="Avg AP score"
                  value={
                    data.summary.averageApPercentage != null
                      ? `${data.summary.averageApPercentage}%`
                      : "—"
                  }
                />
                <KpiCard
                  label="Avg SAT total"
                  value={data.summary.averageSatTotal ?? "—"}
                />
                <KpiCard label="Reports" value={data.summary.questionReportCount} />
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">Last activity</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {formatDate(data.summary.lastActivityAt)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  {data.summary.mcqAttempts} MCQ · {data.summary.frqAttempts} FRQ ·{" "}
                  {data.summary.classCount} class{data.summary.classCount !== 1 ? "es" : ""}
                </p>
              </div>

              {data.insights.overall.weeklyAttempts.length > 0 ? (
                <div className="rounded-md border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Weekly attempts</h3>
                  <ul className="mt-3 space-y-2">
                    {data.insights.overall.weeklyAttempts.slice(-8).map((week) => (
                      <li key={week.weekStart} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{week.label}</span>
                        <span className="font-medium text-gray-900">{week.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.insights.overall.subjectPerformance.length > 0 ? (
                <div className="rounded-md border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-900">By subject</h3>
                  <ul className="mt-3 space-y-2">
                    {data.insights.overall.subjectPerformance.map((row) => (
                      <li key={row.subject} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {getInsightsSubjectLabel(row.subject)}
                        </span>
                        <span className="text-gray-500">
                          {row.attemptCount} attempt{row.attemptCount !== 1 ? "s" : ""}
                          {row.averageScore != null ? ` · avg ${Math.round(row.averageScore)}%` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {data && tab === "exams" ? (
            <div className="space-y-4">
              {data.attempts.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No exam attempts yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Exam</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Score</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.attempts.map((attempt) => (
                        <tr key={`${attempt.examKind}-${attempt.id}`}>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                            {formatDate(attempt.completedAt ?? attempt.startedAt)}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-gray-900" title={attempt.title}>
                            {attempt.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                            {attempt.examProgram}/{attempt.examKind.toUpperCase()}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                statusBadgeClass(attempt.status)
                              )}
                            >
                              {statusLabel(attempt.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                            {formatScore(attempt)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                            {formatDuration(attempt.timeSpentSeconds)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                            {attempt.attemptNumberOnExam}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canLoadMore ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="w-full rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading…
                    </span>
                  ) : (
                    `Load more (${data.attempts.length} of ${data.attemptsTotal})`
                  )}
                </button>
              ) : null}
            </div>
          ) : null}

          {data && tab === "reports" ? (
            <div className="space-y-3">
              {data.reports.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No question reports.</p>
              ) : (
                data.reports.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{report.examTitle}</p>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {report.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(report.createdAt)} · {report.examKind.toUpperCase()}
                    </p>
                    <p className="mt-2 text-gray-700">{reasonLabels(report.reasonCodes)}</p>
                    {report.customNote ? (
                      <p className="mt-2 text-gray-600 italic">&ldquo;{report.customNote}&rdquo;</p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ) : null}

          {data && tab === "classes" ? (
            <div className="space-y-3">
              {data.classes.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No class memberships.</p>
              ) : (
                data.classes.map((cls) => (
                  <article
                    key={`${cls.role}-${cls.id}`}
                    className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{cls.name}</p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          cls.role === "teacher"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        )}
                      >
                        {cls.role === "teacher" ? "Teacher" : "Student"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-gray-500">Code: {cls.classCode}</p>
                    {cls.role === "student" && cls.teacherName ? (
                      <p className="mt-1 text-gray-600">Teacher: {cls.teacherName}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
                      {cls.role === "student" ? "Joined" : "Created"} {formatDate(cls.joinedAt)}
                      {cls.archived ? " · Archived" : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {data && tab === "errors" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600">Recent errors for this user</p>
                <Link
                  href={`/admin/error-logs?userEmail=${encodeURIComponent(email)}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              {data.errors.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No error logs.</p>
              ) : (
                data.errors.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-md border border-gray-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{entry.errorName}</p>
                      <span className="shrink-0 text-xs text-gray-500">{entry.source}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-gray-700">{entry.message}</p>
                    {entry.pageUrl ? (
                      <p className="mt-1 truncate font-mono text-xs text-gray-500" title={entry.pageUrl}>
                        {entry.pageUrl}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-gray-500">
                      {entry.occurrenceCount} occurrence{entry.occurrenceCount !== 1 ? "s" : ""} · Last{" "}
                      {formatDate(entry.lastSeenAt)} · {entry.status}
                    </p>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
