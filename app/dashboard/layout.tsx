"use client";

import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DashboardAuthProvider, useDashboardAuth } from "@/components/library/DashboardAuthProvider";
import { ArchiveUndoProvider } from "@/components/library/ArchiveUndoToast";
import { DashboardSubnav } from "@/components/library/DashboardSubnav";

function DashboardShellInner({ children }: { children: ReactNode }) {
  const { checkingAuth } = useDashboardAuth();

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <DashboardSubnav />
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <DashboardAuthProvider>
        <ArchiveUndoProvider>
          <DashboardShellInner>{children}</DashboardShellInner>
        </ArchiveUndoProvider>
      </DashboardAuthProvider>
    </Suspense>
  );
}
