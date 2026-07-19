"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import type { QuestionReportInboxItem } from "@/lib/question-report-inbox";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { cn } from "@/lib/utils";

type TabStatus = "open" | "dismissed" | "all";

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

  const loadReports = useCallback(async (token: string, status: TabStatus) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/moderator/reports?status=${status}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load reports.");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setListError("Connection error.");
      setItems([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadReports(accessToken, tab);
  }, [accessToken, checking, tab, loadReports]);

  const setTabAndUrl = useCallback(
    (next: TabStatus) => {
      setTab(next);
      setSelectedKey(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  const syncFiltersToUrl = useCallback(
    (next: { q?: string; subject?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const qVal = next.q ?? q;
      const subjectVal = next.subject ?? subjectFilter;
      if (qVal.trim()) params.set("q", qVal.trim());
      else params.delete("q");
      if (subjectVal) params.set("subject", subjectVal);
      else params.delete("subject");
      router.replace(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath, q, subjectFilter]
  );

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
        await loadReports(accessToken, tab);
      } catch {
        setListError("Connection error.");
      } finally {
        setActionId(null);
      }
    },
    [accessToken, tab, loadReports]
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
                if (e.key === "Enter") syncFiltersToUrl({ q: e.currentTarget.value });
              }}
              placeholder="Search by exam or question…"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Subject</span>
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              syncFiltersToUrl({ subject: e.target.value });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All subjects</option>
            {SUBJECT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SUBJECT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => syncFiltersToUrl({ q })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply
        </button>
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
        <section className="rounded-md border border-gray-200 bg-white shadow-sm">
          {listLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {items.length === 0
                ? "No reported questions in this tab."
                : "No reports match your filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
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
          {!listLoading && total > items.length ? (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              Showing {items.length} of {total} reported questions.
            </p>
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
