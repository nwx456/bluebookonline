"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  BookOpen,
  Clock,
  LayoutDashboard,
  Sparkles,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/library", label: "Library", icon: BookOpen },
  { href: "/dashboard/classes", label: "Classes", icon: Users },
  { href: "/dashboard/history", label: "History", icon: Clock },
  { href: "/dashboard/mistakes", label: "Mistakes", icon: XCircle },
  { href: "/dashboard/archived", label: "Archived", icon: Archive },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/generate", label: "Generate", icon: Sparkles },
  { href: "/dashboard/upload", label: "Upload", icon: Upload },
];

export function DashboardSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard sections"
      className="mb-6 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-max snap-x snap-mandatory gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm sm:flex-wrap sm:min-w-0">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex snap-start items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap min-h-11",
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
