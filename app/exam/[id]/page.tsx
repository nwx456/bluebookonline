"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  Flag,
  MoreHorizontal,
  Highlighter,
  Calculator,
  BookOpen,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const SUBJECTS = [
  { value: "AP_CSA", label: "AP CSA (Computer Science)" },
  { value: "AP_MICROECONOMICS", label: "AP Microeconomics" },
  { value: "AP_MACROECONOMICS", label: "AP Macroeconomics" },
  { value: "AP_PSYCHOLOGY", label: "AP Psychology" },
  { value: "AP_STATISTICS", label: "AP Statistics" },
] as const;

type SubjectValue = (typeof SUBJECTS)[number]["value"];

interface PdfUpload {
  id: string;
  subject: string | null;
  filename: string | null;
}

interface Question {
  id: string;
  upload_id: string;
  question_number: number;
  question_text: string;
  passage_text: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isSvgContent(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return t.startsWith("<svg") || t.includes("<svg");
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [upload, setUpload] = useState<PdfUpload | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [leftPanelPercent, setLeftPanelPercent] = useState(45);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [questionListOpen, setQuestionListOpen] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user?.email ?? "");
    });
  }, [router]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    Promise.all([
      supabase.from("pdf_uploads").select("id, subject, filename").eq("id", id).single(),
      supabase
        .from("questions")
        .select("*")
        .eq("upload_id", id)
        .order("question_number", { ascending: true }),
    ]).then(([uploadRes, questionsRes]) => {
      setLoading(false);
      if (uploadRes.data) setUpload(uploadRes.data as PdfUpload);
      if (questionsRes.data) setQuestions((questionsRes.data as Question[]) ?? []);
    });
  }, [id]);

  const startExam = useCallback(async () => {
    if (!id || !userEmail || questions.length === 0) return;
    setStarting(true);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: id, userEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to start exam");
      setAttemptId(data.attemptId);
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  }, [id, userEmail, questions.length]);

  const saveAnswer = useCallback(
    async (questionId: string, userAnswer: string, isFlagged: boolean) => {
      if (!attemptId) return;
      await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId,
          userAnswer: userAnswer || null,
          isFlagged,
        }),
      });
    },
    [attemptId]
  );

  useEffect(() => {
    if (!attemptId) return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [attemptId]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const percent = Math.max(20, Math.min(70, (e.clientX / window.innerWidth) * 100));
    setLeftPanelPercent(percent);
  }, []);

  const handleResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResize]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [handleResize, handleResizeEnd]);

  const toggleMarkForReview = useCallback(
    (questionId: string) => {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        const isFlagged = next.has(questionId);
        saveAnswer(questionId, answers[questionId] ?? "", isFlagged);
        return next;
      });
    },
    [answers, saveAnswer]
  );

  const currentQuestion = questions[currentIndex] ?? null;
  const subject = (upload?.subject ?? "AP_CSA") as SubjectValue;
  const subjectLabel = SUBJECTS.find((s) => s.value === subject)?.label ?? subject;
  const isCsa = subject === "AP_CSA";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!upload || !id) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Exam not found.</p>
        <Link href="/dashboard" className="text-[#1B365D] font-medium hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <header className="bg-[#1B365D] text-white px-6 py-4">
          <Link href="/dashboard" className="font-semibold hover:underline">
            Bluebook
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm max-w-md w-full text-center">
            <h1 className="text-xl font-semibold text-gray-900">Start Exam</h1>
            <p className="mt-2 text-sm text-gray-600">{subjectLabel}</p>
            <p className="mt-1 text-sm text-gray-500">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={startExam}
              disabled={starting}
              className={cn(
                "mt-6 w-full rounded-md px-4 py-3 text-sm font-medium text-white",
                starting ? "bg-gray-400 cursor-not-allowed" : "bg-[#1B365D] hover:bg-[#152a4a]"
              )}
            >
              {starting ? "Starting…" : "Start Exam"}
            </button>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm text-gray-500 hover:text-[#1B365D]"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const options = [
    { key: "A" as const, text: currentQuestion?.option_a },
    { key: "B" as const, text: currentQuestion?.option_b },
    { key: "C" as const, text: currentQuestion?.option_c },
    { key: "D" as const, text: currentQuestion?.option_d },
    { key: "E" as const, text: currentQuestion?.option_e },
  ].filter((o) => o.text != null && o.text.trim() !== "");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-[#1B365D] text-white flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-semibold hover:underline">
              Bluebook
            </Link>
            <div>
              <p className="text-sm font-medium">Section I</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDirectionsOpen((o) => !o)}
                  className="flex items-center gap-1 text-sm text-white/90 hover:text-white"
                >
                  Directions <ChevronDown className="h-4 w-4" />
                </button>
                {directionsOpen && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded border border-gray-200 bg-white p-3 text-left text-sm text-gray-800 shadow-lg z-10">
                    Answer the multiple-choice questions. You can mark questions for review and
                    navigate with Back/Next.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {timerVisible && (
              <div className="text-center">
                <p className="text-lg font-mono">{formatTimer(elapsedSeconds)}</p>
                <button
                  type="button"
                  onClick={() => setTimerVisible(false)}
                  className="text-xs text-white/80 hover:text-white"
                >
                  Hide
                </button>
              </div>
            )}
            {!timerVisible && (
              <button
                type="button"
                onClick={() => setTimerVisible(true)}
                className="text-sm text-white/90 hover:text-white"
              >
                Show timer
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-sm text-white/90">
                <Highlighter className="h-4 w-4" /> Highlights & Notes
              </span>
              {!isCsa && (
                <span className="flex items-center gap-1 text-sm text-white/90">
                  <Calculator className="h-4 w-4" /> Calculator
                </span>
              )}
              <button type="button" className="p-1 rounded hover:bg-white/10">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        {isCsa && (
          <div className="bg-red-600/90 px-4 py-2 flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4" />
            NO CALCULATOR ALLOWED
          </div>
        )}
        <div className="bg-[#152a4a] px-4 py-2 text-center text-sm font-medium">
          THIS IS A TEST PREVIEW
        </div>
      </header>

      {/* Main: two panels */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left panel */}
        <div
          className="flex-shrink-0 overflow-auto border-r border-gray-200 bg-white"
          style={{ width: `${leftPanelPercent}%` }}
        >
          <div className="p-4 h-full">
            {currentQuestion?.passage_text ? (
              subject === "AP_CSA" ? (
                <pre className="text-sm font-mono bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto whitespace-pre">
                  <code>{currentQuestion.passage_text}</code>
                </pre>
              ) : isSvgContent(currentQuestion.passage_text) ? (
                <div
                  className="overflow-auto max-w-full"
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.passage_text.trim(),
                  }}
                />
              ) : (
                <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                  {currentQuestion.passage_text}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-500">No passage for this question.</p>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          ref={dividerRef}
          className="w-2 flex-shrink-0 bg-gray-200 hover:bg-[#1B365D]/20 cursor-col-resize flex items-center justify-center group"
          onMouseDown={() => {
            isDraggingRef.current = true;
            window.addEventListener("mousemove", handleResize);
            window.addEventListener("mouseup", handleResizeEnd);
          }}
        >
          <div className="w-1 h-8 rounded bg-gray-400 group-hover:bg-[#1B365D]" />
        </div>

        {/* Right panel */}
        <div
          className="flex-1 overflow-auto flex flex-col min-w-0"
          style={{ width: `${100 - leftPanelPercent}%` }}
        >
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-900 text-white font-semibold">
                {currentQuestion?.question_number ?? 0}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentQuestion ? markedForReview.has(currentQuestion.id) : false}
                  onChange={() => currentQuestion && toggleMarkForReview(currentQuestion.id)}
                  className="rounded border-gray-300"
                />
                <Flag className="h-4 w-4" />
                Mark for Review
              </label>
              <div className="ml-auto flex h-8 w-8 items-center justify-center rounded bg-[#1B365D] text-white text-xs font-medium">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>

            <p className="text-gray-900 font-medium">{currentQuestion?.question_text ?? ""}</p>

            <div className="space-y-2">
              {options.map(({ key, text }) => {
                const isSelected = currentQuestion && answers[currentQuestion.id] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (!currentQuestion) return;
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }));
                      saveAnswer(
                        currentQuestion.id,
                        key,
                        markedForReview.has(currentQuestion.id)
                      );
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors",
                      isSelected
                        ? "border-[#1B365D] bg-[#1B365D]/5 text-gray-900"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-800"
                    )}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 font-medium">
                      {key}
                    </span>
                    <span className="flex-1">{text ?? ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-gray-200 bg-[#1B365D] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm">{userEmail || "User"}</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuestionListOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              Question {currentIndex + 1} of {questions.length}
              <ChevronUp className="h-4 w-4" />
            </button>
            {questionListOpen && (
              <div className="absolute bottom-full left-0 mb-1 max-h-48 w-64 overflow-auto rounded border border-gray-200 bg-white py-2 text-gray-800 shadow-lg z-20">
                <div className="grid grid-cols-5 gap-1 p-2">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(i);
                        setQuestionListOpen(false);
                      }}
                      className={cn(
                        "h-8 w-8 rounded text-sm font-medium",
                        i === currentIndex
                          ? "bg-[#1B365D] text-white"
                          : answers[q.id]
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIndex >= questions.length - 1}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-[#1B365D] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
