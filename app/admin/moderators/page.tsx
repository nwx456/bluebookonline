"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";

type ModeratorRow = {
  email: string;
  added_by: string;
  created_at: string;
  active: boolean;
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

export default function AdminModeratorsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [moderators, setModerators] = useState<ModeratorRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

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

  const loadModerators = useCallback(async (token: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/moderators", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load list.");
        setModerators([]);
        return;
      }
      setModerators(Array.isArray(data.moderators) ? data.moderators : []);
    } catch {
      setListError("Connection error.");
      setModerators([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadModerators(accessToken);
  }, [accessToken, checking, loadModerators]);

  const handleAdd = useCallback(async () => {
    if (!accessToken) return;
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setAddError("Enter an email address.");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/moderators", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(typeof data.error === "string" ? data.error : "Could not add moderator.");
        return;
      }
      setNewEmail("");
      await loadModerators(accessToken);
    } catch {
      setAddError("Connection error.");
    } finally {
      setAddLoading(false);
    }
  }, [accessToken, newEmail, loadModerators]);

  const handleRemove = useCallback(
    async (email: string) => {
      if (!accessToken) return;
      setRemovingEmail(email);
      try {
        const res = await fetch(`/api/admin/moderators/${encodeURIComponent(email)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setListError(typeof data.error === "string" ? data.error : "Could not remove moderator.");
          return;
        }
        await loadModerators(accessToken);
      } catch {
        setListError("Connection error.");
      } finally {
        setRemovingEmail(null);
      }
    },
    [accessToken, loadModerators]
  );

  if (checking) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-600" aria-hidden />
        <h1 className="text-xl font-semibold text-gray-900">Moderators</h1>
      </div>

      <section className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-900">Add moderator</h2>
        <p className="mt-1 text-sm text-gray-600">
          Grant moderator access by email. Users who sign in with this address are redirected to the
          moderator panel.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="moderator@example.com"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={addLoading}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={addLoading}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            Add
          </button>
        </div>
        {addError ? <p className="mt-2 text-sm text-red-600">{addError}</p> : null}
      </section>

      <section className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-gray-900">Active moderators</h2>
        {listError ? <p className="mt-2 text-sm text-red-600">{listError}</p> : null}
        {listLoading ? (
          <div className="mt-4 flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
          </div>
        ) : moderators.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No moderators yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Added by</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Added</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {moderators.map((m) => (
                  <tr key={m.email}>
                    <td className="px-4 py-3 font-mono text-gray-900">{m.email}</td>
                    <td className="px-4 py-3 text-gray-600">{m.added_by}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleRemove(m.email)}
                        disabled={removingEmail === m.email}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {removingEmail === m.email ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
