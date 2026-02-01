"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { OtpInput } from "@/components/ui/OtpInput";

function VerifyOtpContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email") ?? "";
    try {
      setEmail(emailParam ? decodeURIComponent(emailParam) : "");
    } catch {
      setEmail("");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (code.length !== 4) {
      setError("Enter the 4-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        return;
      }
      router.push("/login?verified=1");
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Verify email</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter the 4-digit code sent to <strong>{email || "your email"}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {!email && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D]"
              placeholder="you@example.com"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Verification code</label>
          <OtpInput
            value={code}
            onChange={setCode}
            disabled={loading}
            error={!!error}
            aria-label="Verification code"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || code.length !== 4}
          className="w-full rounded-md bg-[#1B365D] px-4 py-3 text-sm font-medium text-white hover:bg-[#152a4a] disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Verify account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/signup" className="font-medium text-[#1B365D] hover:underline">
          ← Back to sign up
        </Link>
      </p>
    </div>
  );
}

const VerifyOtpContent = dynamic(() => Promise.resolve(VerifyOtpContentInner), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
      <div className="mt-6 flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-12 w-12 bg-gray-100 rounded-md" />)}
      </div>
    </div>
  ),
});

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="mt-4 h-4 bg-gray-100 rounded w-full" />
        <div className="mt-6 flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-12 w-12 bg-gray-100 rounded-md" />)}
        </div>
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  );
}
