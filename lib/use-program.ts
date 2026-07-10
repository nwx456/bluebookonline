"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ExamProgram } from "@/lib/exam-program";

const STORAGE_KEY = "bbo:program";

function parseProgram(value: string | null | undefined): ExamProgram | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "sat") return "SAT";
  if (v === "ap") return "AP";
  return null;
}

function readStored(): ExamProgram | null {
  if (typeof window === "undefined") return null;
  try {
    return parseProgram(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(program: ExamProgram) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, program);
  } catch {
    // localStorage unavailable; ignore.
  }
}

/**
 * Build a URL preserving the current path + search params, with `program`
 * set to the given value. Used by the global toggle and by HeaderNav links
 * so navigation between pages preserves the active program.
 */
export function appendProgramToHref(href: string, program: ExamProgram): string {
  try {
    const isAbsolute = /^https?:\/\//i.test(href);
    const url = new URL(href, isAbsolute ? undefined : "http://_local");
    url.searchParams.set("program", program.toLowerCase());
    if (isAbsolute) return url.toString();
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
  } catch {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}program=${program.toLowerCase()}`;
  }
}

/**
 * Global AP/SAT program state.
 *
 * Read order: URL `?program=` > localStorage `bbo:program` > "AP".
 * Writes propagate to both URL (router.replace) and localStorage so the
 * selection persists across navigations and reloads.
 */
export function useProgram(): {
  program: ExamProgram;
  setProgram: (next: ExamProgram) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlProgram = parseProgram(searchParams?.get("program"));
  // The initial value must match what the server rendered (URL param or "AP");
  // reading localStorage here would cause a hydration mismatch that React
  // refuses to patch, leaving the toggle visually stuck on the wrong program.
  // The stored preference is applied in the effect below, which triggers a
  // proper re-render.
  const [program, setProgramState] = useState<ExamProgram>(urlProgram ?? "AP");

  useEffect(() => {
    if (urlProgram) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgramState(urlProgram);
      writeStored(urlProgram);
      return;
    }
    const stored = readStored();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgramState(stored);
      // Reflect the restored preference in the URL so server-rendered pages
      // (/exams, /about, /blog) and every useProgram instance agree.
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("program", stored.toLowerCase());
      try {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      } catch {
        // ignore navigation errors (no-op)
      }
    }
  }, [urlProgram, pathname, router, searchParams]);

  const setProgram = useCallback(
    (next: ExamProgram) => {
      setProgramState(next);
      writeStored(next);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("program", next.toLowerCase());
      const qs = params.toString();
      const url = `${pathname}${qs ? `?${qs}` : ""}`;
      try {
        router.replace(url, { scroll: false });
      } catch {
        // ignore navigation errors (no-op)
      }
    },
    [router, pathname, searchParams]
  );

  return { program, setProgram };
}
