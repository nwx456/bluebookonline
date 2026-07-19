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

/** SEO hub path for each program (no query params). */
export function programHubPath(program: ExamProgram): string {
  return program === "SAT" ? "/sat" : "/";
}

function programFromPathname(pathname: string): ExamProgram | null {
  if (pathname === "/sat" || pathname.startsWith("/sat/")) return "SAT";
  if (pathname === "/") return "AP";
  return null;
}

function isProgramHub(pathname: string): boolean {
  return pathname === "/" || pathname === "/sat";
}

/**
 * Build navigation href preserving program context.
 * Hubs use clean paths (/ and /sat); other pages use ?program=sat for SAT UX only.
 */
export function appendProgramToHref(href: string, program: ExamProgram): string {
  try {
    const isAbsolute = /^https?:\/\//i.test(href);
    const url = new URL(href, isAbsolute ? undefined : "http://_local");

    if (url.pathname === "/" || url.pathname === "/sat") {
      url.pathname = programHubPath(program);
      url.searchParams.delete("program");
      if (isAbsolute) return url.toString();
      const qs = url.searchParams.toString();
      return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
    }

    if (program === "SAT") {
      url.searchParams.set("program", "sat");
    } else {
      url.searchParams.delete("program");
    }
    if (isAbsolute) return url.toString();
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
  } catch {
    if (href === "/" || href === "/sat") return programHubPath(program);
    const sep = href.includes("?") ? "&" : "?";
    return program === "SAT" ? `${href}${sep}program=sat` : href.split("?")[0];
  }
}

/**
 * Global AP/SAT program state.
 *
 * Read order: hub path (/sat) > URL ?program= > localStorage > AP.
 * Hub pages use clean URLs; other pages may use ?program=sat for UI filtering only.
 */
export function useProgram(): {
  program: ExamProgram;
  setProgram: (next: ExamProgram) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathProgram = programFromPathname(pathname);
  const urlProgram = parseProgram(searchParams?.get("program"));
  const initialProgram = pathProgram ?? urlProgram ?? "AP";

  const [program, setProgramState] = useState<ExamProgram>(initialProgram);

  useEffect(() => {
    if (pathProgram) {
      setProgramState(pathProgram);
      writeStored(pathProgram);
      if (pathname === "/" && urlProgram === "SAT") {
        router.replace("/sat", { scroll: false });
        return;
      }
      if (pathname === "/" && urlProgram === "AP") {
        router.replace("/", { scroll: false });
        return;
      }
      return;
    }

    if (urlProgram) {
      setProgramState(urlProgram);
      writeStored(urlProgram);
      if (pathname === "/" && urlProgram === "SAT") {
        router.replace("/sat", { scroll: false });
      }
      return;
    }

    const stored = readStored();
    if (stored) {
      setProgramState(stored);
      if (isProgramHub(pathname)) {
        router.replace(programHubPath(stored), { scroll: false });
        return;
      }
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (stored === "SAT") {
        params.set("program", "sat");
      } else {
        params.delete("program");
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [pathProgram, urlProgram, pathname, router, searchParams]);

  const setProgram = useCallback(
    (next: ExamProgram) => {
      setProgramState(next);
      writeStored(next);

      if (isProgramHub(pathname)) {
        router.replace(programHubPath(next), { scroll: false });
        return;
      }

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === "SAT") {
        params.set("program", "sat");
      } else {
        params.delete("program");
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { program, setProgram };
}
