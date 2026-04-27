"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, FileUp, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SubjectHeroCta() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setIsLoggedIn(!!session);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        setIsLoggedIn(!!session);
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  if (isLoggedIn === null) {
    return (
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="h-11 w-full sm:w-40 rounded-md bg-gray-100 animate-pulse" />
        <div className="h-11 w-full sm:w-56 rounded-md bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Sparkles className="h-4 w-4" />
          Go to Dashboard
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FileUp className="h-4 w-4" />
          Upload your PDF
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col sm:flex-row gap-3">
      <Link
        href="/signup"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Sparkles className="h-4 w-4" />
        Sign up free
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <LogIn className="h-4 w-4" />
        Already have an account? Sign in
      </Link>
    </div>
  );
}
