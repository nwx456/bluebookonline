"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { cn } from "@/lib/utils";

const LIMIT = 50;

type RecentSignup = {
  email: string;
  username: string;
  role: string;
  countryCode: string | null;
  legalRegion: string | null;
  marketingOptIn: boolean;
  createdAt: string;
};

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

export default function AdminRecentSignupsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<RecentSignup[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

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

  const loadSignups = useCallback(async () => {
    if (!accessToken) return;
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));

      const res = await fetch(`/api/admin/recent-signups?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load signups.");
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
  }, [accessToken, offset]);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadSignups();
  }, [accessToken, checking, loadSignups]);

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
          <Users className="h-6 w-6 text-blue-600" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Recent Signups</h1>
            <p className="text-sm text-gray-500">Registered users, newest first</p>
          </div>
        </div>
        <Link href="/admin/mail" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to Admin Mail
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>{total.toLocaleString()}</strong> registered user{total !== 1 ? "s" : ""} total
        </span>
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
          <p className="px-6 py-12 text-center text-sm text-gray-500">No registered users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Registered</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Region</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Marketing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.email}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.email}</td>
                    <td className="px-4 py-3 text-gray-900">{item.username || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          roleBadgeClass(item.role)
                        )}
                      >
                        {item.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.countryCode ?? item.legalRegion ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.marketingOptIn ? "Yes" : "No"}
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
              onClick={() => setOffset((prev) => Math.max(0, prev - LIMIT))}
              className="rounded-md border border-gray-200 px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext || listLoading}
              onClick={() => setOffset((prev) => prev + LIMIT)}
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
