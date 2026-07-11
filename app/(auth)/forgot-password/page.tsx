"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

function ForgotPasswordFormInner() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
        <p className="mt-3 text-sm text-gray-600">
          If an account exists with that email, we&apos;ve sent a reset link. The link is valid for
          1 hour.
        </p>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Forgot password</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            placeholder="you@example.com"
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
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

const ForgotPasswordForm = dynamic(() => Promise.resolve(ForgotPasswordFormInner), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
      <div className="mt-6 h-10 bg-gray-100 rounded w-full" />
    </div>
  ),
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
