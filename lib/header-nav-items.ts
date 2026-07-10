import type { LucideIcon } from "lucide-react";
import { BookOpen, Home, Info, LayoutDashboard, Newspaper } from "lucide-react";

export type HeaderNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: string;
  noProgram?: boolean;
};

export const PUBLIC_NAV_ITEMS: HeaderNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/exams", label: "Practice Tests", icon: BookOpen, matchPrefix: "/exams" },
  { href: "/blog", label: "Blog", icon: Newspaper, matchPrefix: "/blog" },
  { href: "/about", label: "About", icon: Info, matchPrefix: "/about" },
];

export function isNavItemActive(pathname: string | null, item: HeaderNavItem): boolean {
  if (!pathname) return false;
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  if (item.href === "/") return pathname === "/";
  return pathname === item.href;
}

export function navItemsForUser(loggedIn: boolean): HeaderNavItem[] {
  if (loggedIn) {
    return [
      ...PUBLIC_NAV_ITEMS,
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        matchPrefix: "/dashboard",
        noProgram: true,
      },
    ];
  }
  return PUBLIC_NAV_ITEMS;
}
