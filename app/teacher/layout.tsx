"use client";

import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { TeacherAuthProvider } from "@/components/teacher/TeacherAuthProvider";
import { TeacherSubnav } from "@/components/teacher/TeacherSubnav";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <TeacherAuthProvider>
        <div className="min-h-screen bg-[#F9FAFB]">
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <TeacherSubnav />
            {children}
          </main>
        </div>
      </TeacherAuthProvider>
    </Suspense>
  );
}
