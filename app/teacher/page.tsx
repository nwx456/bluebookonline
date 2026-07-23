"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Loader2, LogOut, Plus, Users } from "lucide-react";
import { InstitutionBadge } from "@/components/institution/InstitutionBadge";
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

type InstitutionMembership = {
  id: string;
  name: string;
  institutionStatus: string;
  membershipStatus: "pending" | "active" | "removed";
  requestedAt: string;
  approvedAt: string | null;
};

export default function TeacherOverviewPage() {
  const { accessToken } = useTeacherAuth();
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinInstitution, setShowJoinInstitution] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [classInstitutionId, setClassInstitutionId] = useState("independent");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const activeInstitutions = institutions.filter((i) => i.membershipStatus === "active");

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const headers = teacherAuthHeaders(accessToken);
      const [classesRes, instRes] = await Promise.all([
        fetch("/api/teacher/classes", { headers }),
        fetch("/api/teacher/institutions", { headers }),
      ]);
      const classesData = await classesRes.json();
      const instData = await instRes.json();
      if (!classesRes.ok) throw new Error(classesData.error ?? "Could not load classes.");
      if (!instRes.ok) throw new Error(instData.error ?? "Could not load institutions.");
      setClasses(classesData.classes ?? []);
      setInstitutions(instData.institutions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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
          institutionId: classInstitutionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create class.");
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setClassInstitutionId("independent");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !joinCode.trim()) return;
    setJoining(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/institutions", {
        method: "POST",
        headers: {
          ...teacherAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join institution.");
      setMessage(
        `Join request submitted for ${data.institution?.name ?? "the institution"}. Awaiting approval.`
      );
      setJoinCode("");
      setShowJoinInstitution(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join institution.");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (institutionId: string) => {
    if (!accessToken) return;
    setLeavingId(institutionId);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/institutions/${institutionId}/leave`, {
        method: "POST",
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not leave institution.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave institution.");
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Institutions</h2>
            <p className="mt-1 text-sm text-gray-600">
              Join schools or organizations to create institution-linked classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowJoinInstitution(true)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4" />
            Join Institution with Code
          </button>
        </div>

        {institutions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            You have not joined any institutions yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {institutions.map((inst) => {
              const isActive = inst.membershipStatus === "active";
              const cardContent = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{inst.name}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        inst.membershipStatus === "active"
                          ? "bg-green-100 text-green-800"
                          : inst.membershipStatus === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {inst.membershipStatus}
                    </span>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                  )}
                </>
              );

              return (
                <div
                  key={inst.id}
                  className={`flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${
                    isActive ? "group transition-shadow hover:shadow-md" : ""
                  }`}
                >
                  {isActive ? (
                    <Link
                      href={`/teacher/institutions/${inst.id}`}
                      className="flex min-w-0 flex-1 items-start gap-2"
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-2">{cardContent}</div>
                  )}
                  {(inst.membershipStatus === "active" || inst.membershipStatus === "pending") && (
                    <button
                      type="button"
                      disabled={leavingId === inst.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLeave(inst.id);
                      }}
                      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-60"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Leave
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Classes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create classes, share join codes with students, and assign exams or resources.
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

      {message && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading classes…
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">No classes yet. Create your first class to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/teacher/classes/${cls.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{cls.name}</h2>
                <InstitutionBadge
                  institutionName={cls.isIndependent ? null : cls.institutionName}
                />
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
              <div>
                <label htmlFor="class-institution" className="block text-sm font-medium text-gray-700">
                  Class type
                </label>
                <select
                  id="class-institution"
                  value={classInstitutionId}
                  onChange={(e) => setClassInstitutionId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="independent">Independent</option>
                  {activeInstitutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
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
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinInstitution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Join Institution</h2>
            <p className="mt-1 text-sm text-gray-600">
              Enter the 8-character institution join code. Your request will be pending until approved.
            </p>
            <form onSubmit={handleJoinInstitution} className="mt-4 space-y-4">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                placeholder="ABCD1234"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-center font-mono text-lg tracking-widest"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinInstitution(false)}
                  className="rounded-md px-4 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {joining ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
