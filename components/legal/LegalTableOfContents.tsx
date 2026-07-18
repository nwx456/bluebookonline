"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LegalHeading } from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

type LegalTableOfContentsProps = {
  headings: LegalHeading[];
  basePath: string;
};

export function LegalTableOfContents({ headings, basePath }: LegalTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const h2Headings = headings.filter((h) => h.level === 2);
    if (h2Headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const h of h2Headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  const h2Only = headings.filter((h) => h.level === 2);
  if (h2Only.length === 0) return null;

  return (
    <>
      <div className="lg:hidden print:hidden mb-6">
        <label htmlFor="legal-toc-mobile" className="block text-xs font-medium text-gray-600 mb-1">
          Jump to section
        </label>
        <select
          id="legal-toc-mobile"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          value={activeId || h2Only[0]?.id}
          onChange={(e) => {
            const el = document.getElementById(e.target.value);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {h2Only.map((h) => (
            <option key={h.id} value={h.id}>
              {h.text}
            </option>
          ))}
        </select>
      </div>

      <nav
        aria-label="Table of contents"
        className="hidden lg:block print:hidden lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          On this page
        </p>
        <ul className="space-y-1 border-l border-gray-200 pl-3 text-sm">
          {headings.map((h) => (
            <li key={h.id} className={cn(h.level === 3 && "pl-3")}>
              <Link
                href={`${basePath}#${h.id}`}
                className={cn(
                  "block py-0.5 leading-snug hover:text-blue-600",
                  activeId === h.id ? "font-medium text-blue-600" : "text-gray-600"
                )}
              >
                {h.text}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
