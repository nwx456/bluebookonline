"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!accessToken) return;

      setError(null);
      setSuccess(null);

      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/admin/password", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Password update failed.");
          return;
        }
        setSuccess(typeof data.message === "string" ? data.message : "Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch {
        setError("Connection error.");
      } finally {
        setSubmitting(false);
      }
    },
    [accessToken, confirmPassword, currentPassword, newPassword]
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-blue-600" aria-hidden />
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
        <Link href="/admin/mail" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to Admin Mail
        </Link>
      </div>

      <section className="max-w-md rounded-md border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-gray-600" aria-hidden />
          <h2 className="text-base font-semibold text-gray-900">Change password</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Update the password for your admin account. You must enter your current password to confirm.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
