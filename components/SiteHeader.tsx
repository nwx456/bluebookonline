"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { appendProgramToHref, useProgram } from "@/lib/use-program";

/**
 * Shared site header shell used on every page. Matches the dashboard layout
 * (max-w-5xl, h-14) so the nav bar never shifts when switching pages or AP/SAT.
 */
function SiteHeaderInner() {
  const { program } = useProgram();

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href={appendProgramToHref("/", program)}
          className="flex shrink-0 items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          <BookOpen className="h-6 w-6 shrink-0 text-blue-600" />
          Bluebook Online
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <HeaderNav />
        </div>
      </div>
    </header>
  );
}

function SiteHeaderFallback() {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-gray-900"
        >
          <BookOpen className="h-6 w-6 shrink-0 text-blue-600" />
          Bluebook Online
        </Link>
        <div className="h-9 w-[min(100%,22rem)] shrink-0 rounded-md bg-gray-50" />
      </div>
    </header>
  );
}

export function SiteHeader() {
  return (
    <Suspense fallback={<SiteHeaderFallback />}>
      <SiteHeaderInner />
    </Suspense>
  );
}
