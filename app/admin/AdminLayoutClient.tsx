"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminNav } from "./AdminNav";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPresentation = pathname?.startsWith("/admin/presentation");

  if (isPresentation) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <SiteHeader />
      <AdminNav />
      <div className="flex-1 mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">{children}</div>
    </div>
  );
}
