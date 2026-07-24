"use client";

import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  InstitutionAuthProvider,
  useInstitutionAuth,
} from "@/components/institution/InstitutionAuthProvider";

function InstitutionShellInner({ children }: { children: ReactNode }) {
  const { checkingAuth } = useInstitutionAuth();

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

export default function InstitutionLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <InstitutionAuthProvider>
        <InstitutionShellInner>{children}</InstitutionShellInner>
      </InstitutionAuthProvider>
    </Suspense>
  );
}
