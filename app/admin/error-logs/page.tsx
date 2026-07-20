"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import type { ErrorLogEntry, ErrorLogStatus } from "@/lib/error-logging";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS: { value: ErrorLogStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "client", label: "Client" },
  { value: "server", label: "Server" },
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

function statusBadgeClass(status: ErrorLogStatus): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800";
    case "investigating":
      return "bg-amber-100 text-amber-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default function AdminErrorLogsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ErrorLogStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<"" | "client" | "server">("");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [errorNameFilter, setErrorNameFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErrorLogEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (userEmailFilter.trim()) params.set("userEmail", userEmailFilter.trim());
    if (errorNameFilter.trim()) params.set("errorName", errorNameFilter.trim());
    if (fromFilter) params.set("from", new Date(fromFilter).toISOString());
    if (toFilter) {
      const end = new Date(toFilter);
      end.setHours(23, 59, 59, 999);
      params.set("to", end.toISOString());
    }
    return params.toString();
  }, [page, statusFilter, sourceFilter, userEmailFilter, errorNameFilter, fromFilter, toFilter]);

  const loadEntries = useCallback(async (token: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/admin/error-logs?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Could not load error logs.");
        setEntries([]);
        setTotal(0);
        return;
      }
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setListError("Connection error.");
      setEntries([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadEntries(accessToken);
  }, [accessToken, checking, loadEntries]);

  const loadDetail = useCallback(async (token: string, id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/error-logs/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.entry) {
        setDetail(data.entry as ErrorLogEntry);
      } else {
        setDetail(null);
      }
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(accessToken, selectedId);
  }, [accessToken, selectedId, loadDetail]);

  const updateStatus = useCallback(
    async (status: ErrorLogStatus) => {
      if (!accessToken || !selectedId) return;
      setStatusUpdating(true);
      try {
        const res = await fetch(`/api/admin/error-logs/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.entry) {
          const updated = data.entry as ErrorLogEntry;
          setDetail(updated);
          setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        }
      } finally {
        setStatusUpdating(false);
      }
    },
    [accessToken, selectedId]
  );

  const totalPages = Math.max(1, Math.ceil(total / 50));

  if (checking) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Checking access…
      </main>
    );
  }

  return (
    <main>
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Error Logs</h1>
          <p className="text-sm text-gray-600">Deduplicated client and server errors.</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as ErrorLogStatus | "");
            }}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Source</span>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setPage(1);
              setSourceFilter(e.target.value as "" | "client" | "server");
            }}
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">User email</span>
          <input
            type="search"
            value={userEmailFilter}
            onChange={(e) => {
              setPage(1);
              setUserEmailFilter(e.target.value);
            }}
            placeholder="Filter by email"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Error name</span>
          <input
            type="search"
            value={errorNameFilter}
            onChange={(e) => {
              setPage(1);
              setErrorNameFilter(e.target.value);
            }}
            placeholder="e.g. TypeError"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">From</span>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => {
              setPage(1);
              setFromFilter(e.target.value);
            }}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">To</span>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => {
              setPage(1);
              setToFilter(e.target.value);
            }}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {listError ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {listLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">No error logs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last seen</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Error</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Message</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDate(entry.last_seen_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.error_name}</td>
                    <td className="max-w-xs px-4 py-3 text-gray-700">
                      {truncate(entry.message, 80)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{entry.user_email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{entry.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(entry.status)}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {entry.occurrence_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total} total · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || listLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || listLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detail?.error_name ?? "Error detail"}</SheetTitle>
            <SheetDescription>
              {detail ? `${detail.occurrence_count} occurrence(s)` : "Loading…"}
            </SheetDescription>
          </SheetHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center py-8 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Loading detail…
            </div>
          ) : (
            <div className="space-y-4 px-4 pb-6 text-sm">
              <div className="flex flex-wrap gap-2">
                {(["open", "investigating", "resolved"] as ErrorLogStatus[]).map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={detail.status === status ? "default" : "outline"}
                    disabled={statusUpdating}
                    onClick={() => void updateStatus(status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>

              <div>
                <p className="font-medium text-gray-900">Message</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-gray-700">{detail.message}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-gray-900">Source</p>
                  <p className="text-gray-700 capitalize">{detail.source}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Status code</p>
                  <p className="text-gray-700">{detail.status_code ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">User</p>
                  <p className="break-all text-gray-700">{detail.user_email ?? "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">First seen</p>
                  <p className="text-gray-700">{formatDate(detail.first_seen_at)}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Last seen</p>
                  <p className="text-gray-700">{formatDate(detail.last_seen_at)}</p>
                </div>
              </div>

              {detail.page_url ? (
                <div>
                  <p className="font-medium text-gray-900">Page URL</p>
                  <p className="mt-1 break-all text-gray-700">{detail.page_url}</p>
                </div>
              ) : null}

              {detail.endpoint ? (
                <div>
                  <p className="font-medium text-gray-900">Endpoint</p>
                  <p className="mt-1 break-all text-gray-700">{detail.endpoint}</p>
                </div>
              ) : null}

              {detail.stack_trace ? (
                <div>
                  <p className="font-medium text-gray-900">Stack trace</p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
                    {detail.stack_trace}
                  </pre>
                </div>
              ) : null}

              {Object.keys(detail.last_metadata).length > 0 ? (
                <div>
                  <p className="font-medium text-gray-900">Metadata</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                    {JSON.stringify(detail.last_metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
