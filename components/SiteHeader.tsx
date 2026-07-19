"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { HeaderNav } from "@/components/HeaderNav";
import { programHubPath, useProgram } from "@/lib/use-program";

const headerShell =
  "border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 pt-[env(safe-area-inset-top)]";
const headerRow =
  "mx-auto flex w-full max-w-6xl min-h-14 flex-nowrap items-center justify-between gap-3 px-3 py-1.5 sm:gap-4 sm:px-6 sm:py-2";

function BrandMark({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center self-center transition-opacity hover:opacity-90"
    >
      <BrandLogo size="header" priority />
    </Link>
  );
}

function SiteHeaderInner() {
  const { program } = useProgram();

  return (
    <header className={headerShell}>
      <div className={headerRow}>
        <div className="flex w-full min-w-0 items-center justify-between gap-2 md:w-auto md:justify-start md:gap-4">
          <BrandMark href={programHubPath(program)} />
          <HeaderNav />
        </div>
      </div>
    </header>
  );
}

function SiteHeaderFallback() {
  return (
    <header className={headerShell}>
      <div className={headerRow}>
        <div className="flex w-full min-w-0 items-center justify-between gap-2 md:w-auto md:justify-start md:gap-4">
          <BrandMark href="/" />
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <div className="hidden h-9 w-56 rounded-full bg-gray-50 md:block" />
            <div className="h-9 w-9 rounded-md bg-gray-50 md:h-9 md:w-28" />
          </div>
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
