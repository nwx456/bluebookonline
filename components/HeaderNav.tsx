"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Home, LayoutDashboard, LogIn, LogOut, UserPlus, Info, BookOpen, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgramTabs } from "@/components/ProgramTabs";
import { appendProgramToHref, useProgram } from "@/lib/use-program";

/**
 * Public wrapper that adds a Suspense boundary so HeaderNavInner can safely
 * call `useSearchParams()` (via `useProgram`) on any page without forcing
 * every consumer to add its own boundary.
 */
export function HeaderNav() {
  return (
    <Suspense fallback={<HeaderNavSkeleton />}>
      <HeaderNavInner />
    </Suspense>
  );
}

function HeaderNavSkeleton() {
  return (
    <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
      <div className="mr-2 h-9 min-w-[7.25rem] shrink-0 rounded-full border border-gray-200 bg-gray-50" />
      <div className="h-8 w-20 rounded-md bg-gray-50" />
      <div className="h-8 w-20 rounded-md bg-gray-50" />
    </nav>
  );
}

function HeaderNavInner() {
  const pathname = usePathname();
  const { program, setProgram } = useProgram();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigError(true);
    }
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Helper: append ?program= to public-facing links so program selection
  // is preserved when the user navigates around the site.
  const href = (target: string) => appendProgramToHref(target, program);

  const programToggle = (
    <ProgramTabs
      program={program}
      onChange={setProgram}
      className="mr-2 shrink-0"
    />
  );

  if (!mounted || configError) {
    return (
      <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {programToggle}
        <Link href={href("/")} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        <Link href={href("/exams")} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <BookOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Practice Tests</span>
        </Link>
        <Link href={href("/blog")} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <Newspaper className="h-4 w-4" />
          <span className="hidden sm:inline">Blog</span>
        </Link>
        <Link href={href("/about")} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">About</span>
        </Link>
        <Link href="/login" className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
        <Link href="/signup" className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Sign up</span>
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
      <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {programToggle}
        <Link
          href={href("/")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname === "/"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        <Link
          href={href("/exams")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith("/exams")
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Practice Tests</span>
        </Link>
        <Link
          href={href("/blog")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith("/blog")
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <Newspaper className="h-4 w-4" />
          <span className="hidden sm:inline">Blog</span>
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname?.startsWith("/dashboard")
              ? "bg-blue-50 text-blue-600"
              : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <div className="ml-3 flex items-center gap-2 border-l border-gray-200 pl-4">
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
    <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
      {programToggle}
      <Link
        href={href("/")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          pathname === "/"
            ? "bg-blue-50 text-blue-600"
            : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
        )}
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Home</span>
      </Link>
      <Link
        href={href("/exams")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          pathname?.startsWith("/exams")
            ? "bg-blue-50 text-blue-600"
            : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
        )}
      >
        <BookOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Practice Tests</span>
      </Link>
      <Link
        href={href("/blog")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          pathname?.startsWith("/blog")
            ? "bg-blue-50 text-blue-600"
            : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
        )}
      >
        <Newspaper className="h-4 w-4" />
        <span className="hidden sm:inline">Blog</span>
      </Link>
      <Link
        href={href("/about")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          pathname?.startsWith("/about")
            ? "bg-blue-50 text-blue-600"
            : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
        )}
      >
        <Info className="h-4 w-4" />
        <span className="hidden sm:inline">About</span>
      </Link>
      <Link href="/login" className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
        <LogIn className="h-4 w-4" />
        Sign in
      </Link>
      <Link href="/signup" className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Sign up</span>
      </Link>
    </nav>
  );
}
