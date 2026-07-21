"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Activity, ExternalLink, Eye, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import type { ModeratorActivityAction, ModeratorActivityItem } from "@/lib/moderator-activity";
import { buildFrqExamPreviewUrl, buildMcqExamPreviewUrl } from "@/lib/moderator-exam-preview";
import { cn } from "@/lib/utils";

const LIMIT = 50;

const ACTION_OPTIONS: { value: "" | ModeratorActivityAction; label: string }[] = [
  { value: "", label: "All actions" },
  { value: "approve", label: "Approve exam" },
  { value: "reject", label: "Reject exam" },
  { value: "unpublish", label: "Unpublish exam" },
  { value: "dismiss", label: "Dismiss report" },
  { value: "delete", label: "Delete question" },
  { value: "notify", label: "Notify reporter" },
];

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

function actionBadgeClass(action: ModeratorActivityAction): string {
  switch (action) {
    case "approve":
      return "bg-green-100 text-green-800";
    case "reject":
      return "bg-red-100 text-red-800";
    case "unpublish":
      return "bg-amber-100 text-amber-800";
    case "dismiss":
      return "bg-gray-100 text-gray-700";
    case "delete":
      return "bg-red-50 text-red-700";
    case "notify":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function actionLabel(action: ModeratorActivityAction): string {
  return ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

function targetTypeLabel(targetType: ModeratorActivityItem["targetType"]): string {
  switch (targetType) {
    case "exam_mcq":
      return "MCQ exam";
    case "exam_frq":
      return "FRQ exam";
    case "report":
      return "Report";
    default:
      return targetType;
  }
}

function buildExamScreenHref(item: ModeratorActivityItem): string | null {
  if (!item.uploadId || !item.questionId || !item.examKind) return null;
  if (item.examKind === "frq") {
    return buildFrqExamPreviewUrl(item.uploadId, item.questionId, item.partLabel);
  }
  return buildMcqExamPreviewUrl(item.uploadId, item.questionId);
}

function ActivityPreviewActions({
  item,
  accessToken,
  previewLoadingId,
  onPdfPreview,
}: {
  item: ModeratorActivityItem;
  accessToken: string | null;
  previewLoadingId: string | null;
  onPdfPreview: (item: ModeratorActivityItem) => void;
}) {
  const examScreenHref = buildExamScreenHref(item);
  const isExamRow = item.targetType === "exam_mcq" || item.targetType === "exam_frq";
  const showPdf = isExamRow && item.hasStoragePath && item.uploadId;

  if (!showPdf && !examScreenHref) {
    return <span className="text-gray-400">—</span>;
  }

  if (item.targetType === "report" && examScreenHref) {
    return (
      <a
        href={examScreenHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        View exam
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPdf ? (
        <button
          type="button"
          disabled={!accessToken || previewLoadingId === item.id}
          onClick={() => onPdfPreview(item)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {previewLoadingId === item.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden />
          )}
          PDF
        </button>
      ) : null}
      {examScreenHref ? (
        <a
          href={examScreenHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Exam
        </a>
      ) : null}
    </div>
  );
}

export default function AdminModeratorActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<ModeratorActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [registeredModeratorEmails, setRegisteredModeratorEmails] = useState<string[]>([]);
  const [activityModeratorEmails, setActivityModeratorEmails] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const [moderatorFilter, setModeratorFilter] = useState(() => searchParams.get("moderator") ?? "");
  const [actionFilter, setActionFilter] = useState(() => searchParams.get("action") ?? "");
  const [offset, setOffset] = useState(() => {
    const raw = Number(searchParams.get("offset"));
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      if (!isAdminBroadcastEmail(session.user.email)) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(session.access_token ?? null);
      setChecking(false);
    });
  }, [router]);

  const syncUrl = useCallback(
    (next: { moderator?: string; action?: string; offset?: number }) => {
      const params = new URLSearchParams();
      const mod = next.moderator ?? moderatorFilter;
      const act = next.action ?? actionFilter;
      const off = next.offset ?? offset;
      if (mod) params.set("moderator", mod);
      if (act) params.set("action", act);
      if (off > 0) params.set("offset", String(off));
      const qs = params.toString();
      router.replace(qs ? `/admin/activity?${qs}` : "/admin/activity");
    },
    [router, moderatorFilter, actionFilter, offset]
  );

  useEffect(() => {
    if (!accessToken || checking) return;
    fetch("/api/admin/moderators", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const fromModerators = Array.isArray(data.moderators)
          ? data.moderators
              .map((m: { email?: string }) => (typeof m.email === "string" ? m.email.trim().toLowerCase() : ""))
              .filter(Boolean)
          : [];
        setRegisteredModeratorEmails(fromModerators.sort());
      })
      .catch(() => {});
  }, [accessToken, checking]);

  const loadActivity = useCallback(async () => {
    if (!accessToken) return;
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (moderatorFilter) params.set("moderator", moderatorFilter);
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));

      const res = await fetch(`/api/admin/moderator-activity?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load activity.");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setActivityModeratorEmails(
        Array.isArray(data.moderatorEmails)
          ? data.moderatorEmails
              .filter((e: unknown) => typeof e === "string")
              .map((e: string) => e.trim().toLowerCase())
          : []
      );
    } catch {
      setListError("Connection error.");
      setItems([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [accessToken, moderatorFilter, actionFilter, offset]);

  const openPdfPreview = useCallback(
    async (item: ModeratorActivityItem) => {
      if (!accessToken || !item.uploadId) return;
      setPreviewLoadingId(item.id);
      try {
        const kindParam = item.examKind === "frq" ? "?examKind=frq" : "";
        const res = await fetch(`/api/moderator/exams/${item.uploadId}/url${kindParam}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.url !== "string") {
          setListError(typeof data.error === "string" ? data.error : "Could not load PDF preview.");
          return;
        }
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch {
        setListError("Connection error while loading PDF preview.");
      } finally {
        setPreviewLoadingId(null);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadActivity();
  }, [accessToken, checking, loadActivity]);

  const moderatorOptions = useMemo(() => {
    const set = new Set([...registeredModeratorEmails, ...activityModeratorEmails]);
    if (moderatorFilter) set.add(moderatorFilter.trim().toLowerCase());
    return [...set].sort();
  }, [registeredModeratorEmails, activityModeratorEmails, moderatorFilter]);

  const canPrev = offset > 0;
  const canNext = offset + LIMIT < total;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + LIMIT, total);

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
          <Activity className="h-6 w-6 text-blue-600" aria-hidden />
          <h1 className="text-xl font-semibold text-gray-900">Moderator Activity</h1>
        </div>
        <Link href="/admin/mail" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to Admin Mail
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Moderator</span>
          <select
            value={moderatorFilter}
            onChange={(e) => {
              setModeratorFilter(e.target.value);
              setOffset(0);
              syncUrl({ moderator: e.target.value, offset: 0 });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All moderators</option>
            {moderatorOptions.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Action</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
              syncUrl({ action: e.target.value, offset: 0 });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </p>
      ) : null}

      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        {listLoading && items.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">No moderator activity found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Moderator</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Target</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Preview</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(item.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.moderatorEmail}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          actionBadgeClass(item.action)
                        )}
                      >
                        {actionLabel(item.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.targetLabel}</div>
                      <div className="text-xs text-gray-500">{targetTypeLabel(item.targetType)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ActivityPreviewActions
                        item={item}
                        accessToken={accessToken}
                        previewLoadingId={previewLoadingId}
                        onPdfPreview={openPdfPreview}
                      />
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-500" title={item.note ?? undefined}>
                      {item.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {total > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {pageStart}–{pageEnd} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canPrev || listLoading}
              onClick={() => {
                const next = Math.max(0, offset - LIMIT);
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
                const next = offset + LIMIT;
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
    </main>
  );
}
