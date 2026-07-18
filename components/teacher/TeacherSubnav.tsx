"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FolderOpen, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/teacher", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/teacher/content", label: "My Content", icon: FolderOpen },
  { href: "/dashboard", label: "Student Dashboard", icon: BookOpen },
];

export function TeacherSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Teacher sections"
      className="sticky top-14 z-[9] -mx-3 mb-6 overflow-x-auto bg-[#F9FAFB] px-3 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
