"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PublishedExam {
  id: string;
  filename: string;
  questionCount: number;
  ownerUsername: string;
  createdAt?: string;
}

interface ApiResponse {
  exams?: Array<{
    id: string;
    filename: string;
    questionCount: number;
    ownerUsername: string;
    createdAt?: string;
  }>;
  error?: string;
}

interface Props {
  subjectKey: string;
  subjectFullName: string;
  subjectShortName: string;
}

export function PublishedExamsList({ subjectKey, subjectFullName, subjectShortName }: Props) {
  const [exams, setExams] = useState<PublishedExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/exams/published?subject=${encodeURIComponent(subjectKey)}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setExams([]);
          return;
        }
        setExams(data.exams ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load exams.");
        setExams([]);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectKey]);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setIsLoggedIn(!!session);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (cancelled) return;
        setIsLoggedIn(!!session);
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  const isLoading = exams === null;
  const count = exams?.length ?? 0;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Published {subjectFullName} practice exams
        </h2>
        <span className="text-sm text-gray-500">
          {isLoading ? "Loading…" : `${count} ${count === 1 ? "exam" : "exams"}`}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 shrink-0 rounded bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2 w-1/2 rounded bg-gray-200" />
                <div className="h-2 w-1/3 rounded bg-gray-200" />
              </div>
              <div className="mt-4 h-9 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : count === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-gray-900">
            No published {subjectShortName} exams yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Be the first to upload and share an {subjectFullName} practice test.{" "}
            {isLoggedIn
              ? "Upload your own PDF; AI will extract the questions automatically."
              : "Sign up to upload your own PDF; AI will extract the questions automatically."}
          </p>
          {isLoggedIn === null ? (
            <div className="mt-5 inline-block h-10 w-44 rounded-md bg-gray-100 animate-pulse" />
          ) : isLoggedIn ? (
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload your PDF
            </Link>
          ) : (
            <Link
              href="/signup"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload the first exam
            </Link>
          )}
          {error && (
            <p className="mt-3 text-xs text-red-500">Failed to load exams: {error}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams!.map((exam) => (
            <div
              key={exam.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="flex items-start gap-3">
                <FileText className="h-7 w-7 shrink-0 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 truncate" title={exam.filename}>
                    {exam.filename}
                  </h3>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500">{exam.questionCount} questions</p>
                <p className="text-xs text-gray-500">{exam.ownerUsername}</p>
              </div>
              <div className="mt-4">
                <Link
                  href={`/exam/${exam.id}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Play className="h-4 w-4" />
                  Solve
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
