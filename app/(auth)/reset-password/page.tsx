"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LinkState = "loading" | "valid" | "invalid";

function ResetPasswordFormInner() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkState, setLinkState] = useState<LinkState>("loading");
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let resolved = false;

    const resolveValid = () => {
      if (!resolved) {
        resolved = true;
        setLinkState("valid");
      }
    };

    const resolveInvalid = () => {
      if (!resolved) {
        resolved = true;
        setLinkState("invalid");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        resolveValid();
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError || !session?.access_token) {
        resolveInvalid();
        return;
      }
      resolveValid();
    });

    const timeout = window.setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          resolveValid();
        } else {
          resolveInvalid();
        }
      });
    }, 2500);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError("Invalid or expired reset link. Please request a new one.");
        setLinkState("invalid");
        return;
      }

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password reset failed.");
        if (res.status === 401) {
          setLinkState("invalid");
        }
        return;
      }

      await supabase.auth.signOut();
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (linkState === "loading") {
    return (
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
        <div className="mt-6 h-10 bg-gray-100 rounded w-full" />
        <div className="mt-4 h-10 bg-gray-100 rounded w-full" />
      </div>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Link expired</h1>
        <p className="mt-3 text-sm text-gray-600">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Reset password</h1>
      <p className="mt-1 text-sm text-gray-500">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

const ResetPasswordForm = dynamic(() => Promise.resolve(ResetPasswordFormInner), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
      <div className="mt-6 h-10 bg-gray-100 rounded w-full" />
      <div className="mt-4 h-10 bg-gray-100 rounded w-full" />
    </div>
  ),
});

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
