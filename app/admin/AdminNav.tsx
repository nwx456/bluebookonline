"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import { Activity, AlertTriangle, ClipboardCheck, FileText, Flag, Mail, Presentation, Settings, Shield, Users } from "lucide-react";

import { cn } from "@/lib/utils";



const tabs = [

  { href: "/admin/mail", label: "Mail", icon: Mail },

  { href: "/admin/users", label: "Users", icon: Users },

  { href: "/admin/error-logs", label: "Error Logs", icon: AlertTriangle },

  { href: "/admin/pdfs", label: "PDFs", icon: FileText },

  { href: "/admin/moderation", label: "Exam Approval", icon: ClipboardCheck },

  { href: "/admin/reports", label: "Reported Questions", icon: Flag },

  { href: "/admin/moderators", label: "Moderators", icon: Shield },

  { href: "/admin/activity", label: "Moderator Activity", icon: Activity },

  { href: "/admin/presentation", label: "Presentation (TR)", icon: Presentation },

  { href: "/admin/presentation/en", label: "Presentation (EN)", icon: Presentation },

  { href: "/admin/settings", label: "Settings", icon: Settings },

] as const;



export function AdminNav() {

  const pathname = usePathname();



  return (

    <nav
      className="sticky top-14 z-[9] border-b border-gray-200 bg-white"
      aria-label="Admin sections"
    >

      <div className="mx-auto w-full max-w-5xl overflow-x-auto px-3 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        <div className="flex min-w-max gap-1">

          {tabs.map(({ href, label, icon: Icon }) => {

            const active =
              href === "/admin/presentation"
                ? pathname === "/admin/presentation"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (

              <Link

                key={href}

                href={href}

                className={cn(

                  "flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",

                  active

                    ? "border-blue-600 text-blue-600"

                    : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"

                )}

              >

                <Icon className="h-4 w-4 shrink-0" aria-hidden />

                {label}

              </Link>

            );

          })}

        </div>

      </div>

    </nav>

  );

}

