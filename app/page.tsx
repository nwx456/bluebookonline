"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeaderNav } from "@/components/HeaderNav";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { FileText, ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBJECTS = [
  { value: "", label: "All subjects" },
  { value: "AP_CSA", label: "AP CSA (Computer Science)" },
  { value: "AP_MICROECONOMICS", label: "AP Microeconomics" },
  { value: "AP_MACROECONOMICS", label: "AP Macroeconomics" },
  { value: "AP_PSYCHOLOGY", label: "AP Psychology" },
  { value: "AP_STATISTICS", label: "AP Statistics" },
] as const;

interface PublishedExam {
  id: string;
  filename: string;
  subject: string;
  questionCount: number;
  ownerUsername: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [exams, setExams] = useState<PublishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const url = subjectFilter
        ? `/api/exams/published?subject=${encodeURIComponent(subjectFilter)}`
        : "/api/exams/published";
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setExams(data.exams ?? []);
      } else {
        setExams([]);
      }
    } catch {
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const subjectLabel = SUBJECTS.find((s) => s.value === subjectFilter)?.label ?? "All subjects";

  const handleSolveClick = (examId: string) => {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(`/exam/${examId}`);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="font-semibold text-gray-900">
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            Bluebook Online
          </h1>
          <p className="mt-2 text-gray-600">
            Browse and solve published exams. Sign in to upload and share your own.
          </p>
          {!mounted ? null : !user ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign up
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Dashboard
            </Link>
          )}
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Published exams</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSubjectOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                  "hover:bg-gray-50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                )}
              >
                {subjectLabel}
                <ChevronDown className={cn("h-4 w-4 text-gray-500", subjectOpen && "rotate-180")} />
              </button>
              {subjectOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setSubjectOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s.value || "all"}
                        type="button"
                        onClick={() => {
                          setSubjectFilter(s.value);
                          setSubjectOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm",
                          subjectFilter === s.value
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
              Loading…
            </div>
          ) : exams.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
              No published exams yet. Upload your own to share with others.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 shrink-0 text-blue-600" />
                    <h3 className="flex-1 min-w-0 font-medium text-gray-900 truncate" title={exam.filename}>
                      {exam.filename}
                    </h3>
                  </div>
                  <div className="mt-3 space-y-1">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {SUBJECTS.find((s) => s.value === exam.subject)?.label ?? exam.subject}
                    </span>
                    <p className="text-xs text-gray-500">
                      {exam.questionCount} questions
                    </p>
                    <p className="text-xs text-gray-500">
                      {exam.ownerUsername}
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => handleSolveClick(exam.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      Solve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
