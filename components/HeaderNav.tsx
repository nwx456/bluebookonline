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
        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#1B365D]">
          Sign in
        </Link>
        <Link href="/signup" className="rounded-md bg-[#1B365D] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a]">
          Sign up
        </Link>
      </nav>
    );
  }

  if (user) {
    return (
      <nav className="flex gap-4">
        <Link href="/dashboard" className="rounded-md bg-[#1B365D] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a]">
          Dashboard
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex gap-4">
      <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[#1B365D]">
        Sign in
      </Link>
      <Link href="/signup" className="rounded-md bg-[#1B365D] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a]">
        Sign up
      </Link>
    </nav>
  );
}
