"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  LogOut,
  Plus,
  Users,
} from "lucide-react";
import { ClassCodeCopyButton } from "@/components/teacher/ClassCodeCopyButton";
import {
  teacherAuthHeaders,
  useTeacherAuth,
} from "@/components/teacher/TeacherAuthProvider";

type ClassCard = {
  id: string;
  name: string;
  description: string | null;
  classCode: string;
  memberCount: number;
  assignmentCount: number;
  createdAt: string;
  institutionId: string | null;
  institutionName: string | null;
  isIndependent: boolean;
};

type InstitutionDetail = {
  id: string;
  name: string;
  status: string;
  membershipStatus: string;
  requestedAt: string | null;
  approvedAt: string | null;
};

export default function TeacherInstitutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const institutionId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useTeacherAuth();

  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!accessToken || !institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/institutions/${institutionId}`, {
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load institution.");
      setInstitution(data.institution ?? null);
      setClasses(data.classes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load institution.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, institutionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: {
          ...teacherAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          institutionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create class.");
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class.");
    } finally {
      setCreating(false);
    }
  };

  const handleLeave = async () => {
    if (!accessToken || !institutionId) return;
    if (
      !window.confirm(
        `Leave ${institution?.name ?? "this institution"}? Your classes in this institution will remain but you will no longer be a member.`
      )
    ) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/institutions/${institutionId}/leave`, {
        method: "POST",
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not leave institution.");
      router.push("/teacher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave institution.");
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading institution…
      </div>
    );
  }

  if (!institution) {
    return (
      <div>
        <Link
          href="/teacher"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Institution not found."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/teacher"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to overview
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h1 className="text-xl font-semibold text-gray-900">{institution.name}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                institution.membershipStatus === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {institution.membershipStatus}
            </span>
            {institution.status === "suspended" && (
              <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Institution suspended
              </span>
            )}
            {institution.approvedAt && (
              <span className="text-xs text-gray-500">
                Member since {new Date(institution.approvedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={leaving}
          onClick={handleLeave}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {leaving ? "Leaving…" : "Leave Institution"}
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Classes in this institution</h2>
          <p className="mt-1 text-sm text-gray-600">
            View and manage your classes linked to {institution.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Class
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">
            No classes in this institution yet. Create your first class to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              {cls.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{cls.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>{cls.memberCount} students</span>
                <span>{cls.assignmentCount} assignments</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800">
                  {cls.classCode}
                </code>
                <ClassCodeCopyButton code={cls.classCode} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Create Class</h2>
            <p className="mt-1 text-sm text-gray-600">
              This class will be linked to {institution.name}.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="class-name" className="block text-sm font-medium text-gray-700">
                  Class name
                </label>
                <input
                  id="class-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={120}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  placeholder="AP Biology Period 3"
                />
              </div>
              <div>
                <label htmlFor="class-desc" className="block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  id="class-desc"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
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
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
