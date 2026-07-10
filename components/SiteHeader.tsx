"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { appendProgramToHref, useProgram } from "@/lib/use-program";

const headerShell =
  "border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 pt-[env(safe-area-inset-top)]";
const headerRow =
  "mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:h-16 sm:gap-6 sm:px-8";

function BrandMark({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold text-gray-900 transition-colors hover:text-blue-600"
    >
      <BookOpen className="h-5 w-5 shrink-0 text-blue-600 sm:h-6 sm:w-6" aria-hidden />
      <span className="text-sm leading-none tracking-tight sm:text-base">Bluebook Online</span>
    </Link>
  );
}

function SiteHeaderInner() {
  const { program } = useProgram();

  return (
    <header className={headerShell}>
      <div className={headerRow}>
        <BrandMark href={appendProgramToHref("/", program)} />
        <HeaderNav />
      </div>
    </header>
  );
}

function SiteHeaderFallback() {
  return (
    <header className={headerShell}>
      <div className={headerRow}>
        <BrandMark href="/" />
        <div className="flex items-center gap-2">
          <div className="hidden h-9 w-56 rounded-full bg-gray-50 md:block" />
          <div className="h-10 w-10 rounded-md bg-gray-50 md:h-9 md:w-28" />
        </div>
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
