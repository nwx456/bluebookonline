"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users } from "lucide-react";
import { InstitutionBadge } from "@/components/institution/InstitutionBadge";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";

type ClassCard = {
  id: string;
  name: string;
  description: string | null;
  teacherName: string;
  memberCount: number;
  assignmentCount: number;
  institutionName: string | null;
  isIndependent: boolean;
};

export default function StudentClassesPage() {
  const { accessToken } = useDashboardAuth();
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/classes", {
        headers: libraryAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load classes.");
      setClasses(data.classes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !classCode.trim()) return;
    setJoining(true);
    setJoinMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/student/classes/join", {
        method: "POST",
        headers: {
          ...libraryAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classCode: classCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join class.");
      setJoinMessage(
        data.alreadyMember
          ? `You are already in ${data.class?.name ?? "this class"}.`
          : `Joined ${data.class?.name ?? "class"} successfully!`
      );
      setClassCode("");
      setShowJoin(false);
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join class.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Classes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Join classes with a code from your teacher and view assigned work.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowJoin(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Join Class
        </button>
      </div>

      {joinMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {joinMessage}
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
          Loading…
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-600">
            You are not in any classes yet. Ask your teacher for a class code.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/dashboard/classes/${cls.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-gray-900">{cls.name}</h2>
                <InstitutionBadge
                  institutionName={cls.isIndependent ? null : cls.institutionName}
                />
              </div>
              <p className="mt-1 text-sm text-gray-600">Teacher: {cls.teacherName}</p>
              <div className="mt-4 flex gap-3 text-xs text-gray-500">
                <span>{cls.memberCount} classmates</span>
                <span>{cls.assignmentCount} assignments</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Join Class</h2>
            <p className="mt-1 text-sm text-gray-600">
              Enter the 8-character class code from your teacher.
            </p>
            <form onSubmit={handleJoin} className="mt-4 space-y-4">
              <input
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                placeholder="ABCD1234"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-center font-mono text-lg tracking-widest"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="rounded-md px-4 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {joining ? "Joining…" : "Join"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
