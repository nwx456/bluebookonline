"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";

type InstitutionRow = {
  id: string;
  ownerEmail: string;
  name: string;
  joinCode: string;
  status: "active" | "suspended";
  createdAt: string;
  teacherCount: number;
  classCount: number;
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

export default function AdminInstitutionsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const loadInstitutions = useCallback(async (token: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/institutions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Failed to load list.");
        setInstitutions([]);
        return;
      }
      setInstitutions(Array.isArray(data.institutions) ? data.institutions : []);
    } catch {
      setListError("Connection error.");
      setInstitutions([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadInstitutions(accessToken);
  }, [accessToken, checking, loadInstitutions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(typeof data.error === "string" ? data.error : "Could not create institution.");
        return;
      }
      setShowCreate(false);
      setName("");
      setEmail("");
      setPassword("");
      setStatus("active");
      await loadInstitutions(accessToken);
    } catch {
      setCreateError("Connection error.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (inst: InstitutionRow) => {
    if (!accessToken) return;
    const newStatus = inst.status === "active" ? "suspended" : "active";
    setUpdatingId(inst.id);
    try {
      const res = await fetch(`/api/admin/institutions/${inst.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setListError(typeof data.error === "string" ? data.error : "Could not update status.");
        return;
      }
      await loadInstitutions(accessToken);
    } catch {
      setListError("Connection error.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking access…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Institutions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage school or organization accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Institution
        </button>
      </div>

      {listError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </div>
      )}

      {listLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading institutions…
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">No institutions yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Admin Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Teachers</th>
                <th className="px-4 py-3">Classes</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{inst.name}</td>
                  <td className="px-4 py-3 text-gray-600">{inst.ownerEmail}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        inst.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {inst.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{inst.teacherCount}</td>
                  <td className="px-4 py-3">{inst.classCount}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(inst.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={updatingId === inst.id}
                      onClick={() => handleToggleStatus(inst)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {updatingId === inst.id
                        ? "Updating…"
                        : inst.status === "active"
                          ? "Suspend"
                          : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Add Institution</h2>
            {createError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="inst-name" className="block text-sm font-medium text-gray-700">
                  Institution Name
                </label>
                <input
                  id="inst-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="inst-email" className="block text-sm font-medium text-gray-700">
                  Admin Email
                </label>
                <input
                  id="inst-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="inst-password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="inst-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="inst-status" className="block text-sm font-medium text-gray-700">
                  Initial Status
                </label>
                <select
                  id="inst-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create Institution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
