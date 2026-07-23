"use client";

import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { InstitutionAuthProvider } from "@/components/institution/InstitutionAuthProvider";

export default function InstitutionLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <InstitutionAuthProvider>
        <div className="min-h-screen bg-[#F9FAFB]">
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </div>
      </InstitutionAuthProvider>
    </Suspense>
  );
}
