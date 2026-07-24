"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginFormInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  useEffect(() => {
    if (searchParams.get("verified") === "1") setVerified(true);
    if (searchParams.get("reset") === "1") setResetSuccess(true);
  }, [searchParams]);

  const signupHref = nextParam
    ? `/signup?next=${encodeURIComponent(nextParam)}`
    : "/signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(nextParam ? { next: nextParam } : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      if (data.session?.access_token && data.session?.refresh_token) {
        const supabase = createClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) {
          setError("Sign in failed. Please try again.");
          return;
        }
        await supabase.auth.getSession();
      }
      const redirectPath =
        typeof data.redirectPath === "string" ? data.redirectPath : "/dashboard";
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        setError("Sign in timed out. Please try again.");
      } else {
        setError("Connection error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500">Sign in to your account.</p>
      {verified && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Your account has been verified. You can sign in now.
        </p>
      )}
      {resetSuccess && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          Your password has been reset. You can sign in now.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="text"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href={signupHref} className="font-medium text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

const LoginForm = dynamic(() => Promise.resolve(LoginFormInner), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
      <div className="mt-6 h-10 bg-gray-100 rounded w-full" />
      <div className="mt-4 h-10 bg-gray-100 rounded w-full" />
    </div>
  ),
});

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
        <div className="mt-6 h-10 bg-gray-100 rounded w-full" />
        <div className="mt-4 h-10 bg-gray-100 rounded w-full" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
