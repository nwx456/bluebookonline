"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogIn, UserPlus } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ProfileSheet } from "@/components/user/ProfileSheet";
import { UserAvatar } from "@/components/user/UserAvatar";
import { cn } from "@/lib/utils";
import { ProgramTabs } from "@/components/ProgramTabs";
import { MobileNavMenu } from "@/components/MobileNavMenu";
import { appendProgramToHref, useProgram } from "@/lib/use-program";
import { isNavItemActive, navItemsForUser } from "@/lib/header-nav-items";

export function HeaderNav() {
  return (
    <Suspense fallback={<HeaderNavSkeleton />}>
      <HeaderNavInner />
    </Suspense>
  );
}

function HeaderNavSkeleton() {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:min-w-0 md:shrink">
      <div className="hidden h-9 w-56 rounded-full bg-gray-50 md:block" />
      <div className="h-9 w-9 rounded-md bg-gray-50 md:hidden" />
      <div className="hidden h-9 w-28 rounded-md bg-gray-50 md:block" />
    </div>
  );
}

function HeaderNavInner() {
  const pathname = usePathname();
  const { program, setProgram } = useProgram();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);

  async function loadUserRoles(token: string | null) {
    if (!token) {
      setIsTeacher(false);
      setIsInstitution(false);
      return;
    }
    try {
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setIsTeacher(false);
        setIsInstitution(false);
        return;
      }
      const data = await res.json();
      setIsTeacher(data.role === "TEACHER");
      setIsInstitution(data.role === "INSTITUTION");
    } catch {
      setIsTeacher(false);
      setIsInstitution(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        setUser(session?.user ?? null);
        await loadUserRoles(session?.access_token ?? null);
      }).catch(() => {
        setUser(null);
        setIsTeacher(false);
        setIsInstitution(false);
      });
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user ?? null);
        await loadUserRoles(session?.access_token ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigError(true);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // proceed to home even if signOut fails
    }
    window.location.href = "/";
  };

  const resolveHref = (target: string, noProgram?: boolean) =>
    noProgram ? target : appendProgramToHref(target, program);

  const loggedIn = mounted && !configError && Boolean(user);
  const items = navItemsForUser(loggedIn, isTeacher, program, isInstitution);

  const displayName = user
    ? (user.user_metadata?.username as string)?.trim() ||
      user.email?.split("@")[0] ||
      "Account"
    : "";
  const openProfile = () => setProfileOpen(true);

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:ml-0 md:min-w-0 md:shrink">
      <nav
        className="hidden items-center gap-1 md:flex lg:gap-1.5"
        aria-label="Main navigation"
      >
        <ProgramTabs program={program} onChange={setProgram} className="mr-1 shrink-0" />
        {items.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item);
          return (
            <Link
              key={item.href + item.label}
              href={resolveHref(item.href, item.noProgram)}
              title={item.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:px-2.5",
                active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100 hover:text-blue-600"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only lg:not-sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {loggedIn && user ? (
        <>
          <div className="hidden items-center gap-2 border-l border-gray-200 pl-3 md:flex">
            <NotificationBell />
            <button
              type="button"
              onClick={openProfile}
              className="inline-flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              aria-label="Open profile"
            >
              <UserAvatar displayName={displayName} avatarUrl={avatarUrl} size="sm" />
              <span
                className="hidden max-w-[7rem] truncate text-sm font-medium text-gray-700 xl:inline"
                title={user.email ?? ""}
              >
                {displayName}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <NotificationBell />
            <button
              type="button"
              onClick={openProfile}
              className="rounded-md p-0.5 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              aria-label="Open profile"
            >
              <UserAvatar displayName={displayName} avatarUrl={avatarUrl} size="sm" />
            </button>
          </div>
          <ProfileSheet
            user={user}
            displayName={displayName}
            onSignOut={handleSignOut}
            open={profileOpen}
            onOpenChange={setProfileOpen}
            avatarUrl={avatarUrl}
            onAvatarUrlChange={setAvatarUrl}
            hideTrigger
          />
        </>
      ) : mounted && !configError ? (
        <div className="hidden items-center gap-1.5 border-l border-gray-200 pl-3 md:flex">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Sign up
          </Link>
        </div>
      ) : null}

      {!loggedIn && mounted && !configError && (
        <Link
          href="/signup"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 md:hidden"
          aria-label="Sign up"
        >
          <UserPlus className="h-4 w-4" />
        </Link>
      )}

      <MobileNavMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        pathname={pathname}
        program={program}
        onProgramChange={setProgram}
        user={loggedIn ? user : null}
        avatarUrl={avatarUrl}
        resolveHref={resolveHref}
        isTeacher={isTeacher}
        isInstitution={isInstitution}
        onSignOut={handleSignOut}
        onOpenProfile={() => {
          setMobileOpen(false);
          setProfileOpen(true);
        }}
      />
    </div>
  );
}
