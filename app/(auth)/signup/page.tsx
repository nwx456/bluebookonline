"use client";



import { useState, Suspense } from "react";

import dynamic from "next/dynamic";

import Link from "next/link";

import { useSearchParams } from "next/navigation";

import {

  COUNTRY_GROUPS,

  countriesByRegion,

  setStoredLegalRegion,

  type LegalRegion,

} from "@/lib/legal/countries";



function SignUpFormInner() {

  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next");



  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [countryCode, setCountryCode] = useState("");

  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [accountRole, setAccountRole] = useState<"STUDENT" | "TEACHER">("STUDENT");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState(false);

  const [sentEmail, setSentEmail] = useState("");



  const loginHref = nextParam

    ? `/login?next=${encodeURIComponent(nextParam)}`

    : "/login";



  const verifyOtpHref = (emailValue: string) => {

    const params = new URLSearchParams({ email: emailValue });

    if (nextParam) params.set("next", nextParam);

    return `/verify-otp?${params.toString()}`;

  };



  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();

    setError("");

    const normalizedUsername = username.trim().toLowerCase();

    if (normalizedUsername.length < 4 || normalizedUsername.length > 20 || !/^[a-z0-9]+$/.test(normalizedUsername)) {

      setError("Username must be 4-20 characters, lowercase letters and numbers only.");

      return;

    }

    if (!countryCode) {

      setError("Please select your country.");

      return;

    }

    if (!ageConfirmed) {

      setError("You must confirm you are at least 13 years old.");

      return;

    }

    if (!termsAccepted) {

      setError("You must accept the Terms of Service and Privacy Policy.");

      return;

    }

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

        body: JSON.stringify({

          email: email.trim(),

          password,

          username: normalizedUsername,

          countryCode,

          ageConfirmed13Plus: true,

          termsAccepted: true,

          marketingOptIn,

          role: accountRole,

        }),

      });

      const data = await res.json();

      if (!res.ok) {

        setError(data.error || "Sign up failed.");

        return;

      }

      if (data.legalRegion) {

        setStoredLegalRegion(data.legalRegion as LegalRegion);

      }

      setSuccess(true);

      setSentEmail(data.email ?? email);

    } catch {

      setError("Connection error. Please try again.");

    } finally {

      setLoading(false);

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

          href={verifyOtpHref(sentEmail)}

          className="mt-6 block w-full rounded-md bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"

        >

          Go to verification

        </Link>

      </div>

    );

  }



  return (

    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">

      <h1 className="text-xl font-semibold text-gray-900">Sign up</h1>

      <p className="mt-1 text-sm text-gray-500">Create an account with username, email and password.</p>



      <form onSubmit={handleSubmit} className="mt-6 space-y-4">

        <div>
          <span className="block text-sm font-medium text-gray-700">I am a...</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountRole("STUDENT")}
              className={`rounded-md border px-3 py-3 text-left text-sm transition-colors ${
                accountRole === "STUDENT"
                  ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="font-medium">Student</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Practice exams and track progress
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAccountRole("TEACHER")}
              className={`rounded-md border px-3 py-3 text-left text-sm transition-colors ${
                accountRole === "TEACHER"
                  ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="font-medium">Teacher</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Manage classes and assign work
              </span>
            </button>
          </div>
        </div>

        <div>

          <label htmlFor="username" className="block text-sm font-medium text-gray-700">

            Username

          </label>

          <input

            id="username"

            type="text"

            autoComplete="username"

            value={username}

            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}

            required

            minLength={4}

            maxLength={20}

            pattern="[a-z0-9]{4,20}"

            title="4-20 characters, lowercase letters and numbers only"

            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"

            placeholder="4-20 characters, lowercase & numbers"

          />

        </div>

        <div>

          <label htmlFor="country" className="block text-sm font-medium text-gray-700">

            Country / region

          </label>

          <select

            id="country"

            value={countryCode}

            onChange={(e) => setCountryCode(e.target.value)}

            required

            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"

          >

            <option value="">Select your country</option>

            {COUNTRY_GROUPS.map((group) => (

              <optgroup key={group.region} label={group.label}>

                {countriesByRegion(group.region).map((c) => (

                  <option key={c.code} value={c.code}>

                    {c.name}

                  </option>

                ))}

              </optgroup>

            ))}

          </select>

          <p className="mt-1 text-xs text-gray-500">Used to apply the correct privacy rules for your region.</p>

        </div>

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

            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"

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

            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"

            placeholder="Re-enter password"

          />

        </div>



        <label className="flex items-start gap-2 text-sm text-gray-700">

          <input

            type="checkbox"

            checked={ageConfirmed}

            onChange={(e) => setAgeConfirmed(e.target.checked)}

            required

            className="mt-0.5 rounded border-gray-300"

          />

          <span>I confirm I am at least 13 years old.</span>

        </label>



        <label className="flex items-start gap-2 text-sm text-gray-700">

          <input

            type="checkbox"

            checked={termsAccepted}

            onChange={(e) => setTermsAccepted(e.target.checked)}

            required

            className="mt-0.5 rounded border-gray-300"

          />

          <span>

            I agree to the{" "}

            <Link href="/terms" className="text-blue-600 hover:underline">

              Terms of Service

            </Link>

            ,{" "}

            <Link href="/privacy" className="text-blue-600 hover:underline">

              Privacy Policy

            </Link>

            , and{" "}

            <Link href="/cookies" className="text-blue-600 hover:underline">

              Cookie Policy

            </Link>

            .

          </span>

        </label>



        <label className="flex items-start gap-2 text-sm text-gray-700">

          <input

            type="checkbox"

            checked={marketingOptIn}

            onChange={(e) => setMarketingOptIn(e.target.checked)}

            className="mt-0.5 rounded border-gray-300"

          />

          <span>Send me product updates and tips by email (optional).</span>

        </label>



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

          {loading ? "Sending…" : "Send verification code"}

        </button>

      </form>



      <p className="mt-6 text-center text-sm text-gray-500">

        Already have an account?{" "}

        <Link href={loginHref} className="font-medium text-blue-600 hover:underline">

          Sign in

        </Link>

      </p>

    </div>

  );

}



const SignUpForm = dynamic(() => Promise.resolve(SignUpFormInner), {

  ssr: false,

  loading: () => (

    <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">

      <div className="h-6 bg-gray-200 rounded w-1/3" />

      <div className="mt-4 h-4 bg-gray-100 rounded w-full" />

      <div className="mt-6 h-10 bg-gray-100 rounded w-full" />

    </div>

  ),

});



export default function SignUpPage() {

  return (

    <Suspense

      fallback={

        <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm animate-pulse">

          <div className="h-6 bg-gray-200 rounded w-1/3" />

          <div className="mt-4 h-4 bg-gray-100 rounded w-full" />

          <div className="mt-6 h-10 bg-gray-100 rounded w-full" />

        </div>

      }

    >

      <SignUpForm />

    </Suspense>

  );

}


