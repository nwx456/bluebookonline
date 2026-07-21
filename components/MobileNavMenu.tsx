"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { LogIn, LogOut, Menu, UserPlus, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { ProgramTabs } from "@/components/ProgramTabs";
import type { ExamProgram } from "@/lib/exam-program";
import { isNavItemActive, navItemsForUser, type HeaderNavItem } from "@/lib/header-nav-items";
import { UserAvatar } from "@/components/user/UserAvatar";

export type MobileNavMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string | null;
  program: ExamProgram;
  onProgramChange: (program: ExamProgram) => void;
  user: User | null;
  avatarUrl?: string | null;
  isTeacher?: boolean;
  resolveHref: (target: string, noProgram?: boolean) => string;
  onSignOut: () => void;
  onOpenProfile?: () => void;
};

export function MobileNavMenu({
  open,
  onOpenChange,
  pathname,
  program,
  onProgramChange,
  user,
  avatarUrl = null,
  isTeacher = false,
  resolveHref,
  onSignOut,
  onOpenProfile,
}: MobileNavMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const items = navItemsForUser(Boolean(user), isTeacher, program);
  const displayName = user
    ? (user.user_metadata?.username as string)?.trim() ||
      user.email?.split("@")[0] ||
      "Account"
    : "";

  return (
    <>
      <button
        type="button"
        ref={toggleRef}
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu overlay"
            onClick={close}
          />
          <div
            id="mobile-nav-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-gray-200 bg-white shadow-xl pt-[env(safe-area-inset-top)]"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Program
              </p>
              <ProgramTabs program={program} onChange={onProgramChange} className="w-full justify-center" />

              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile navigation">
                {items.map((item) => (
                  <MobileNavLink
                    key={item.href + item.label}
                    item={item}
                    href={resolveHref(item.href, item.noProgram)}
                    active={isNavItemActive(pathname, item)}
                    onNavigate={close}
                  />
                ))}
              </nav>

              <div className="mt-6 border-t border-gray-100 pt-4">
                {user ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onOpenProfile?.();
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-gray-50"
                    >
                      <UserAvatar displayName={displayName} avatarUrl={avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                        <p className="truncate text-xs text-gray-500">{user.email}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onSignOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/login"
                      onClick={close}
                      className="flex items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={close}
                      className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileNavLink({
  item,
  href,
  active,
  onNavigate,
}: {
  item: HeaderNavItem;
  href: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-100"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </Link>
  );
}
