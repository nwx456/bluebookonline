"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeaderNav } from "@/components/HeaderNav";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { FileText, ChevronDown, ChevronUp, Play, BookOpen, Upload, AlertTriangle, Search, LayoutDashboard, Brain, Share2, PanelLeft, LayoutTemplate, Navigation, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECT_KEYS, SUBJECT_LABELS } from "@/lib/gemini-prompts";

const SUBJECTS = [
  { value: "", label: "All subjects" },
  ...SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] })),
];

interface PublishedExam {
  id: string;
  filename: string;
  subject: string;
  questionCount: number;
  ownerUsername: string;
  createdAt?: string;
}

export default function Home() {
  const router = useRouter();
  const [exams, setExams] = useState<PublishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [howToOpen, setHowToOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [interfaceGuideOpen, setInterfaceGuideOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      setConfigError(true);
    }
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

  const isNewExam = (createdAt?: string) => {
    if (!createdAt) return false;
    const d = new Date(createdAt);
    const now = new Date();
    return now.getTime() - d.getTime() < 3 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        <section className="mb-8 text-center rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100">
          <div className="flex items-center justify-center gap-3">
            <BookOpen className="h-12 w-12 text-blue-600 shrink-0" />
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              Bluebook Online
            </h1>
          </div>
          <p className="mt-2 text-gray-600">
            Browse and solve published exams. Sign in to upload and share your own.
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-sm text-gray-500">
            Bluebook Online mimics the real College Board Bluebook digital exam experience. Practice AP exams with a familiar interface: upload PDFs, solve questions, get instant scoring. AI can generate answer keys when the PDF has none. For educational practice only.
          </p>
          {configError ? (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 max-w-lg mx-auto">
              Configuration error: Supabase environment variables are missing. If you&apos;re the site owner, add{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel → Project Settings → Environment Variables, then redeploy.
            </div>
          ) : !mounted ? null : !user ? (
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

        <section className="mb-8">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setInterfaceGuideOpen((o) => !o)}
              onKeyDown={(e) => e.key === "Enter" && setInterfaceGuideOpen((o) => !o)}
              className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Exam Interface Guide</h2>
                  <p className="text-xs text-gray-500 mt-0.5">See what the exam screen looks like and what each element does</p>
                </div>
              </div>
              {interfaceGuideOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </div>
            {interfaceGuideOpen && (
              <div className="border-t border-gray-200 p-4 sm:p-6">
                <div className="flex gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 mb-6">
                  <LayoutTemplate className="h-5 w-5 shrink-0 text-indigo-600 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    This is a general overview. The layout can vary by subject. For example, AP CSA shows code; Economics or Psychology may show graphs, tables, or passages. If the display looks wrong or unclear, use <strong>Show page</strong> to view the original question in the PDF.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 mb-6">
                  <img
                    src="/exam-interface-preview.png"
                    alt="Bluebook Online exam interface preview"
                    className="w-full h-auto object-contain max-h-[500px]"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <LayoutDashboard className="h-5 w-5 text-slate-600" />
                      <h3 className="font-semibold text-gray-900">Header Bar</h3>
                    </div>
                    <ul className="space-y-1.5 text-gray-600">
                      <li><strong>Bluebook</strong> – Application branding and link to home.</li>
                      <li><strong>Section I / Directions</strong> – Current section and dropdown for instructions.</li>
                      <li><strong>Timer & Hide</strong> – Countdown for remaining time; Hide to conceal the timer.</li>
                      <li><strong>Highlights & Notes</strong> – Highlight text or add personal notes.</li>
                      <li><strong>Reference</strong> – Access reference materials or documentation.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <PanelLeft className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900">Left Panel – Graphs, Code & Context</h3>
                    </div>
                    <ul className="space-y-1.5 text-gray-600">
                      <li><strong>Purpose</strong> – Shows graphs, tables, code, or passages depending on the subject. Economics may show supply/demand curves; AP CSA shows code; Psychology may show passages.</li>
                      <li><strong>Code segment</strong> – For AP CSA: introduces the code block to analyze.</li>
                      <li><strong>Graphs & tables</strong> – For subjects with visuals: displays charts, diagrams, or data tables.</li>
                      <li><strong>Show page</strong> – Opens the original PDF at the relevant page so you can verify the question as it appears in the source. Use this when the on-screen display looks wrong or unclear. You can scroll through all pages.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <LayoutTemplate className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Right Panel – Question & Answers</h3>
                    </div>
                    <ul className="space-y-1.5 text-gray-600">
                      <li><strong>Question number</strong> – Current question position (e.g. 4).</li>
                      <li><strong>Mark for Review</strong> – Flag the question to revisit before submitting.</li>
                      <li><strong>AP badge</strong> – Indicates Advanced Placement level or category.</li>
                      <li><strong>Multiple-choice options (A–E)</strong> – Select the correct answer; click the option to choose.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border-2 border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Navigation className="h-5 w-5 text-violet-600" />
                      <h3 className="font-semibold text-gray-900">Footer Bar</h3>
                    </div>
                    <ul className="space-y-1.5 text-gray-600">
                      <li><strong>Username</strong> – Displays your user ID or username.</li>
                      <li><strong>Question X of Y</strong> – Current position in the exam; click to open the question grid.</li>
                      <li><strong>Back</strong> – Go to the previous question.</li>
                      <li><strong>Next</strong> – Go to the next question.</li>
                      <li><strong>End Exam</strong> – Submit the exam and see your score (on the last question).</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setHowToOpen((o) => !o)}
              onKeyDown={(e) => e.key === "Enter" && setHowToOpen((o) => !o)}
              className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">How to use</h2>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Start here</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Step-by-step guide to browse, upload, solve, and share exams</p>
                </div>
              </div>
              {howToOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </div>
            {howToOpen && (
              <div className="border-t border-gray-200 px-4 pb-6 pt-4">
                <div className="space-y-4">
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Search className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Browse</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        View all published exams on this page. Use the subject dropdown to filter by AP subject (e.g. AP Psychology, AP Calculus). Click Solve on any exam to start.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Upload className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload</h3>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">
                        <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">Go to Dashboard</Link> and upload your PDF. Follow these steps:
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 font-medium">
                        <li className="pl-1">Select the AP subject from the dropdown.</li>
                        <li className="pl-1">Enter the question count.</li>
                        <li className="pl-1">If your PDF has images, tables, or graphs, check the box.</li>
                        <li className="pl-1">Drag and drop or click to choose the file. The system will extract questions automatically.</li>
                      </ol>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Play className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Solve</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Answer each question by selecting A, B, C, D, or E. Use Mark for Review to flag questions you want to revisit. Navigate with Previous/Next or the question grid. When finished, click End Exam to submit and see your score. The exam interface mimics the real Bluebook digital testing experience.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Brain className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">AI scoring</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        If your PDF has no answer key, AI generates one when you first complete the exam. These answers are saved permanently, so future attempts (yours or others) skip AI and use the stored key. This saves time and API cost.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Share2 className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Publish</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        In your <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">Dashboard</Link>, each exam has a Publish toggle. Turn it on to make the exam visible on this home page for all users. Anyone signed in can then solve it. Turn it off to keep the exam private (only you can solve it). You can toggle anytime. Published exams appear in the list above, sorted by newest first.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setWarningsOpen((o) => !o)}
              onKeyDown={(e) => e.key === "Enter" && setWarningsOpen((o) => !o)}
              className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Warnings</h2>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Important</span>
                </div>
              </div>
              {warningsOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </div>
            {warningsOpen && (
              <div className="border-t border-gray-200 px-4 pb-4 pt-2">
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div><strong>Display accuracy</strong> – The exam screen may not always display questions correctly. When in doubt, use the <strong>Show page</strong> button to view the original question in the PDF.</div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div><strong>PDF only</strong> – Only PDF format is accepted for uploads.</div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div><strong>AI accuracy</strong> – AI-generated answer keys may not always be correct. Use for practice only; verify important answers with official sources.</div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div>Poor scan quality, skewed pages, or low resolution can affect question extraction and AI scoring accuracy.</div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div>This is not an official College Board or AP exam platform. We mimic the Bluebook digital exam experience for practice; for educational use only.</div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div>The timer is optional and does not reflect official AP exam timing. Use it as a rough guide.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSubjectsOpen((o) => !o)}
              onKeyDown={(e) => e.key === "Enter" && setSubjectsOpen((o) => !o)}
              className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600 shrink-0" />
                <h2 className="text-base font-semibold text-gray-900">Supported subjects</h2>
              </div>
              {subjectsOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </div>
            {subjectsOpen && (
              <div className="border-t border-gray-200 px-4 pb-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {SUBJECT_KEYS.map((key) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      {SUBJECT_LABELS[key].replace(/^AP /, "")}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFaqOpen((o) => !o)}
              onKeyDown={(e) => e.key === "Enter" && setFaqOpen((o) => !o)}
              className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600 shrink-0" />
                <h2 className="text-base font-semibold text-gray-900">FAQ</h2>
              </div>
              {faqOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </div>
            {faqOpen && (
              <div className="border-t border-gray-200 px-4 pb-4 pt-2">
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-900">What is Bluebook Online?</dt>
                    <dd className="mt-1 text-sm text-gray-600">
                      A free platform that mimics the real College Board Bluebook digital exam experience. Practice AP exams with a familiar interface: upload PDFs, solve multiple-choice questions, and get instant scoring. AI can generate answer keys when your PDF has none.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-900">Is it free?</dt>
                    <dd className="mt-1 text-sm text-gray-600">
                      Yes. Bluebook Online mimics the real Bluebook experience and is free for educational use. Sign up to upload and publish exams.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-900">How does AI scoring work?</dt>
                    <dd className="mt-1 text-sm text-gray-600">
                      If your PDF has no answer key, AI generates one when you first complete the exam. The key is saved so future attempts skip AI and use the stored answers.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-900">Can I use my own PDFs?</dt>
                    <dd className="mt-1 text-sm text-gray-600">
                      Yes. Sign in, go to Dashboard, and upload your AP exam PDF. The system extracts questions automatically. You can publish exams to share with others.
                    </dd>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <Link href="/about" className="font-medium text-blue-600 hover:underline">
                        Learn more about Bluebook Online
                      </Link>
                    </p>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </section>

        <section className="mb-8">
          {!loading && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm mb-6 ring-1 ring-gray-100/50">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium text-gray-900">
                  {exams.length} published exam{exams.length !== 1 ? "s" : ""}
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">
                  by {new Set(exams.map((e) => e.ownerUsername)).size} user{new Set(exams.map((e) => e.ownerUsername)).size !== 1 ? "s" : ""}
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">
                  {exams.reduce((s, e) => s + e.questionCount, 0)} total questions
                </span>
              </div>
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col animate-pulse"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 shrink-0 rounded bg-gray-200" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-5 bg-gray-100 rounded w-24" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="mt-4 h-9 bg-gray-200 rounded-md" />
                </div>
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-14 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Upload className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No published exams yet</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                Be the first to upload and share an exam. Sign in to get started.
              </p>
              <Link
                href={user ? "/dashboard" : "/login"}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 shadow-sm hover:shadow"
              >
                <Upload className="h-4 w-4" />
                {user ? "Upload your first exam" : "Sign in to upload"}
              </Link>
            </div>
          ) : (
            <>
              {exams.length > 6 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Recently added</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams.slice(0, 6).map((exam) => (
                      <div
                        key={exam.id}
                        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="h-8 w-8 shrink-0 text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 truncate" title={exam.filename}>
                                {exam.filename}
                              </h3>
                              {isNewExam(exam.createdAt) && (
                                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">New</span>
                              )}
                            </div>
                          </div>
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
                </div>
              )}
              {exams.length > 6 && <h3 className="text-sm font-medium text-gray-500 mb-3">All published exams</h3>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(exams.length > 6 ? exams.slice(6) : exams).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 shrink-0 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate" title={exam.filename}>
                          {exam.filename}
                        </h3>
                        {isNewExam(exam.createdAt) && (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">New</span>
                        )}
                      </div>
                    </div>
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
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Dashboard
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
                  About
                </Link>
                <span className="text-gray-300">|</span>
                <a href="mailto:info@apbluebookonline.com" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Contact
                </a>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Dashboard
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
                  About
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/login" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Sign in
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/signup" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Sign up
                </Link>
                <span className="text-gray-300">|</span>
                <a href="mailto:info@apbluebookonline.com" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Contact
                </a>
              </>
            )}
          </div>
          <p className="mt-3 text-center text-sm text-gray-600">
            If you encounter any issues, you can always email us at{" "}
            <a href="mailto:info@apbluebookonline.com" className="font-medium text-blue-600 hover:underline">
              info@apbluebookonline.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
