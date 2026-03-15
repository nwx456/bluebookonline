"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Home, LayoutDashboard, LogIn, LogOut, UserPlus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeaderNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      setConfigError(true);
    }
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (!mounted || configError) {
    return (
      <nav className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link href="/about" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <Info className="h-4 w-4" />
          About
        </Link>
        <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
        <Link href="/signup" className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <UserPlus className="h-4 w-4" />
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
    const initial = displayName.charAt(0).toUpperCase();
    return (
      <nav className="flex items-center gap-1">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith("/dashboard")
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="ml-2 flex items-center gap-2 border-l border-gray-200 pl-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600"
            title={user.email ?? ""}
          >
            {initial}
          </div>
          <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[120px] truncate" title={user.email ?? ""}>
            {displayName}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      <Link href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
        <Home className="h-4 w-4" />
        Home
      </Link>
      <Link href="/about" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
        <Info className="h-4 w-4" />
        About
      </Link>
      <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
        <LogIn className="h-4 w-4" />
        Sign in
      </Link>
      <Link href="/signup" className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <UserPlus className="h-4 w-4" />
        Sign up
      </Link>
    </nav>
  );
}
