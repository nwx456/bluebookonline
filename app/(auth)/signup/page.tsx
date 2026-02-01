"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed.");
        return;
      }
      setSuccess(true);
      setSentEmail(data.email ?? email);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearEmail() {
    if (!email.trim()) return;
    setCleaning(true);
    setError("");
    try {
      const res = await fetch("/api/auth/clean-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setError("");
      } else {
        setError(data.error || "Clear failed.");
      }
    } catch {
      setError("Clear failed.");
    } finally {
      setCleaning(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Email sent</h1>
        <p className="mt-2 text-sm text-gray-600">
          We sent a 4-digit verification code to <strong>{sentEmail}</strong>.
        </p>
        <Link
          href={`/verify-otp?email=${encodeURIComponent(sentEmail)}`}
          className="mt-6 block w-full rounded-md bg-[#1B365D] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#152a4a]"
        >
          Go to verification
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Sign up</h1>
      <p className="mt-1 text-sm text-gray-500">Create an account with your email and password.</p>

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
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D]"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D]"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D]"
            placeholder="Re-enter password"
          />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
            {error.includes("already exists") && (
              <button
                type="button"
                onClick={handleClearEmail}
                disabled={cleaning}
                className="text-sm font-medium text-[#1B365D] hover:underline disabled:opacity-60"
              >
                {cleaning ? "Clearing…" : "Clear this email and try again"}
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[#1B365D] px-4 py-3 text-sm font-medium text-white hover:bg-[#152a4a] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send verification code"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#1B365D] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
