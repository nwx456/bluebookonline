"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ExternalLink,
  Loader2,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import type { QuestionReportInboxItem } from "@/lib/question-report-inbox";
import { buildFrqExamPreviewUrl, buildMcqExamPreviewUrl } from "@/lib/moderator-exam-preview";
import { FRQ_COURSE_IDS, getFrqCourseLabel } from "@/lib/frq-courses";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { cn } from "@/lib/utils";

type TabStatus = "open" | "dismissed" | "all";

const REPORTS_PAGE_LIMIT = 50;

type ModeratorReportsClientProps = {
  variant?: "moderator" | "admin";
};

function itemKey(item: QuestionReportInboxItem): string {
  return item.examKind === "frq"
    ? `frq:${item.questionId}:${item.partLabel ?? ""}`
    : `mcq:${item.questionId}`;
}

function formatQuestionLabel(item: QuestionReportInboxItem): string {
  if (item.examKind === "frq" && item.partLabel) {
    return `#${item.questionNumber} (${item.partLabel})`;
  }
  return `#${item.questionNumber}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function ModeratorReportsClient({
  variant = "moderator",
}: ModeratorReportsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminVariant = variant === "admin";
  const basePath = isAdminVariant ? "/admin/reports" : "/moderator/reports";
  const backHref = isAdminVariant ? "/admin/mail" : "/moderator";
  const backLabel = isAdminVariant ? "Back to Admin Mail" : "Back to Moderator Panel";
  const pageTitle = "Reported Questions";

  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabStatus>(() => {
    const s = searchParams.get("status");
    return s === "dismissed" || s === "all" ? s : "open";
  });
  const [items, setItems] = useState<QuestionReportInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [subjectFilter, setSubjectFilter] = useState(() => searchParams.get("subject") ?? "");
  const [offset, setOffset] = useState(() => {
    const raw = Number(searchParams.get("offset"));
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      const token = session.access_token ?? "";

      if (isAdminVariant) {
        if (!isAdminBroadcastEmail(session.user.email)) {
          router.replace("/dashboard");
          return;
        }
        setAccessToken(token);
        setChecking(false);
        return;
      }

      const res = await fetch("/api/moderator/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(token);
      setChecking(false);
    });
  }, [router, isAdminVariant]);

  const fetchGenerationRef = useRef(0);
  const syncUrlRef = useRef<
    (next: { q?: string; subject?: string; offset?: number; status?: TabStatus }) => void
  >(() => {});

  const syncUrl = useCallback(
    (next: { q?: string; subject?: string; offset?: number; status?: TabStatus }) => {
      const params = new URLSearchParams();
      const statusVal = next.status ?? tab;
      const qVal = next.q ?? q;
      const subjectVal = next.subject ?? subjectFilter;
      const offsetVal = next.offset ?? offset;

      params.set("status", statusVal);
      if (qVal.trim()) params.set("q", qVal.trim());
      if (subjectVal) params.set("subject", subjectVal);
      if (offsetVal > 0) params.set("offset", String(offsetVal));

      const qs = params.toString();
      const href = qs ? `${basePath}?${qs}` : basePath;
      if (typeof window !== "undefined") {
        const current = `${window.location.pathname}${window.location.search}`;
        if (current === href) return;
      }
      router.replace(href, { scroll: false });
    },
    [router, basePath, tab, q, subjectFilter, offset]
  );

  syncUrlRef.current = syncUrl;

  const loadReports = useCallback(async () => {
    if (!accessToken) return;

    const generation = ++fetchGenerationRef.current;
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        status: tab,
        limit: String(REPORTS_PAGE_LIMIT),
        offset: String(offset),
      });
      const res = await fetch(`/api/moderator/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (generation !== fetchGenerationRef.current) return;

      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load reports.");
        setItems([]);
        setTotal(0);
        return;
      }

      const nextTotal = typeof data.total === "number" ? data.total : 0;
      const nextItems = Array.isArray(data.items) ? data.items : [];

      if (nextTotal > 0 && offset >= nextTotal && nextItems.length === 0) {
        setOffset(0);
        syncUrlRef.current({ offset: 0 });
        return;
      }

      setTotal(nextTotal);
      setItems(nextItems);
    } catch {
      if (generation !== fetchGenerationRef.current) return;
      setListError("Connection error.");
      setItems([]);
      setTotal(0);
    } finally {
      if (generation === fetchGenerationRef.current) {
        setListLoading(false);
      }
    }
  }, [accessToken, tab, offset]);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadReports();
  }, [accessToken, checking, loadReports]);

  const setTabAndUrl = useCallback(
    (next: TabStatus) => {
      setTab(next);
      setSelectedKey(null);
      setOffset(0);
      syncUrl({ status: next, offset: 0 });
    },
    [syncUrl]
  );

  const hasActiveFilters = Boolean(q.trim() || subjectFilter);

  const clearFilters = useCallback(() => {
    setQ("");
    setSubjectFilter("");
    setOffset(0);
    syncUrl({ q: "", subject: "", offset: 0 });
  }, [syncUrl]);

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      if (subjectFilter && item.exam.subject !== subjectFilter) return false;
      if (!term) return true;
      const haystack = [
        item.exam.filename,
        item.exam.subjectLabel,
        item.questionText,
        formatQuestionLabel(item),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, q, subjectFilter]);

  const canPrev = offset > 0;
  const canNext = offset + REPORTS_PAGE_LIMIT < total;
  const pageStart = total === 0 ? 0 : Math.min(offset + 1, total);
  const pageEnd = total === 0 ? 0 : Math.min(offset + REPORTS_PAGE_LIMIT, total);

  const emptyListMessage = useMemo(() => {
    if (total > 0 && items.length === 0) {
      return "No reports on this page. Go back to the first page.";
    }
    if (items.length > 0 && filteredItems.length === 0) {
      return "No reports on this page match your search or subject filter.";
    }
    if (items.length === 0) {
      return tab === "open"
        ? "No open reported questions. Handled items appear under All."
        : "No reported questions in this tab.";
    }
    return null;
  }, [total, items.length, filteredItems.length, tab]);

  const runAction = useCallback(
    async (
      item: QuestionReportInboxItem,
      action: "dismiss" | "delete" | "notify"
    ) => {
      if (!accessToken) return;
      setActionId(itemKey(item));
      setListError(null);
      setActionMessage(null);
      try {
        const res = await fetch(`/api/moderator/reports/${item.questionId}/${action}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            examKind: item.examKind,
            partLabel: item.partLabel,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setListError(typeof data.error === "string" ? data.error : "Action failed.");
          return;
        }
        if (action === "notify" && typeof data.notified === "number") {
          setActionMessage(`Notified ${data.notified} reporter(s).`);
        } else if (action === "dismiss" && typeof data.dismissed === "number") {
          setActionMessage(`Dismissed ${data.dismissed} report(s).`);
        } else if (action === "delete") {
          setActionMessage(
            item.examKind === "frq"
              ? "FRQ question removed from exam."
              : "Question removed from exam."
          );
          setSelectedKey(null);
          setConfirmDeleteKey(null);
        }
        await loadReports();
      } catch {
        setListError("Connection error.");
      } finally {
        setActionId(null);
      }
    },
    [loadReports]
  );

  const selected = items.find((i) => itemKey(i) === selectedKey) ?? null;

  if (checking) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" aria-hidden />
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
        </div>
        <Link href={backHref} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          {backLabel}
        </Link>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(["open", "dismissed", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTabAndUrl(t)}
            className={cn(
              "min-h-[44px] border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            {t === "open" ? "Open" : t === "dismissed" ? "Dismissed" : "All"}
          </button>
        ))}
      </div>

      {tab === "open" ? (
        <p className="text-xs text-gray-500">
          Handled reports (deleted questions) appear under the All tab only.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") syncUrl({ q: e.currentTarget.value });
              }}
              placeholder="Search by exam or question…"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Subject / course</span>
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setOffset(0);
              syncUrl({ subject: e.target.value, offset: 0 });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All subjects & courses</option>
            <optgroup label="MCQ subjects">
              {SUBJECT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SUBJECT_LABELS[key]}
                </option>
              ))}
            </optgroup>
            <optgroup label="FRQ courses">
              {FRQ_COURSE_IDS.map((courseId) => (
                <option key={courseId} value={courseId}>
                  {getFrqCourseLabel(courseId)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => syncUrl({ q })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {actionMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="relative rounded-md border border-gray-200 bg-white shadow-sm">
          {listLoading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="space-y-3 px-6 py-12 text-center text-sm text-gray-500">
              <p>{emptyListMessage}</p>
              {total > 0 && items.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setOffset(0);
                    syncUrl({ offset: 0 });
                  }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Go to first page
                </button>
              ) : null}
              {items.length > 0 && hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear search and subject filter
                </button>
              ) : null}
            </div>
          ) : (
            <div className={cn("overflow-x-auto", listLoading && "opacity-60")}>
              {listLoading ? (
                <div className="absolute right-3 top-3 z-10">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden />
                </div>
              ) : null}
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Q#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Subject</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Exam</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Reports</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Top reasons</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Last reported</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item) => {
                    const key = itemKey(item);
                    return (
                    <tr
                      key={key}
                      className={cn(
                        "cursor-pointer hover:bg-gray-50",
                        selectedKey === key && "bg-blue-50/60"
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{formatQuestionLabel(item)}</span>
                          {item.examKind === "frq" ? (
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                              FRQ
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.exam.subjectLabel}</td>
                      <td
                        className="max-w-[160px] truncate px-4 py-3 text-gray-600"
                        title={item.exam.filename}
                      >
                        {item.exam.filename}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.reportCount} ({item.reporterCount} users)
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.reasonCounts.slice(0, 2).map((r) => (
                            <span
                              key={r.code}
                              className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700"
                            >
                              {r.count}× {r.label.split(" ")[0]}…
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(item.lastReportedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-gray-400" aria-hidden />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 0 ? (
            <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Showing {pageStart}–{pageEnd} of {total} reported questions
                {filteredItems.length !== items.length
                  ? ` (${filteredItems.length} after filters on this page)`
                  : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canPrev || listLoading}
                  onClick={() => {
                    const next = Math.max(0, offset - REPORTS_PAGE_LIMIT);
                    setOffset(next);
                    syncUrl({ offset: next });
                  }}
                  className="rounded-md border border-gray-200 px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!canNext || listLoading}
                  onClick={() => {
                    const next = offset + REPORTS_PAGE_LIMIT;
                    setOffset(next);
                    syncUrl({ offset: next });
                  }}
                  className="rounded-md border border-gray-200 px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {selected ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close details"
            onClick={() => setSelectedKey(null)}
          />
        ) : null}

        <aside
          className={cn(
            "rounded-md border border-gray-200 bg-white p-4 shadow-sm",
            !selected && "hidden lg:block",
            selected &&
              "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-xl safe-area-bottom lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-md"
          )}
        >
          {selected ? (
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <h2 className="text-sm font-semibold text-gray-900">Report details</h2>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : null}
          {!selected ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Select a question to view details and take action.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Question {formatQuestionLabel(selected)}
                  {selected.examKind === "frq" ? (
                    <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      FRQ
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-gray-500 font-mono">{selected.questionId}</p>
              </div>

              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-gray-700">Exam:</span> {selected.exam.filename}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Subject:</span>{" "}
                  {selected.exam.subjectLabel} ({selected.exam.examProgram ?? "—"})
                </p>
                {selected.exam.sourceAttribution ? (
                  <p className="text-gray-600">{selected.exam.sourceAttribution}</p>
                ) : null}
                {selected.examKind === "mcq" ? (
                  <p>
                    <span className="font-medium text-gray-700">Correct answer:</span>{" "}
                    {selected.correctAnswer ?? "—"}
                  </p>
                ) : null}
              </div>

              <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800">
                {selected.questionText}
              </div>

              {selected.examKind === "mcq" && selected.questionType !== "grid_in" ? (
                <ul className="space-y-1 text-sm text-gray-700">
                  {(["A", "B", "C", "D", "E"] as const).map((key) => {
                    const text = selected.options[key];
                    if (!text) return null;
                    return (
                      <li key={key}>
                        <span className="font-medium">{key}.</span> {text}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div>
                <h3 className="text-sm font-medium text-gray-900">Reason breakdown</h3>
                <ul className="mt-2 space-y-1">
                  {selected.reasonCounts.map((r) => (
                    <li key={r.code} className="flex justify-between text-sm text-gray-600">
                      <span>{r.label}</span>
                      <span className="font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selected.customNotes.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-gray-900">User notes</h3>
                  <ul className="mt-2 space-y-2">
                    {selected.customNotes.map((n, i) => (
                      <li
                        key={`${n.emailMasked}-${i}`}
                        className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-gray-500">{n.emailMasked}</p>
                        <p className="text-gray-700">{n.note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
                {selected.uploadId ? (
                  <a
                    href={
                      selected.examKind === "frq"
                        ? buildFrqExamPreviewUrl(
                            selected.uploadId,
                            selected.questionId,
                            selected.partLabel
                          )
                        : buildMcqExamPreviewUrl(selected.uploadId, selected.questionId)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on exam screen
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={actionId === itemKey(selected)}
                  onClick={() => void runAction(selected, "notify")}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {actionId === itemKey(selected) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  Notify reporters
                </button>
                <button
                  type="button"
                  disabled={actionId === itemKey(selected)}
                  onClick={() => void runAction(selected, "dismiss")}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={actionId === itemKey(selected)}
                  onClick={() => setConfirmDeleteKey(itemKey(selected))}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove from exam
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {confirmDeleteKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Remove question permanently?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  This permanently deletes the question from the database. Existing in-progress
                  sessions may still show it until reload. A snapshot will be saved for audit.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteKey(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!selected && actionId === itemKey(selected)}
                onClick={() => selected && void runAction(selected, "delete")}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {selected && actionId === itemKey(selected) ? "Removing…" : "Remove permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
