"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function HeaderNav() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return (
      <nav className="flex gap-4">
        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600">
          Sign in
        </Link>
        <Link href="/signup" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Sign up
        </Link>
      </nav>
    );
  }

  if (user) {
    const displayName =
      (user.user_metadata?.username as string)?.trim() ||
      user.email?.split("@")[0] ||
      "Account";
    return (
      <nav className="flex items-center gap-4">
        <span className="text-sm text-gray-600" title={user.email ?? ""}>
          {displayName}
        </span>
        <Link href="/dashboard" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Dashboard
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex gap-4">
      <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600">
        Sign in
      </Link>
      <Link href="/signup" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        Sign up
      </Link>
    </nav>
  );
}
