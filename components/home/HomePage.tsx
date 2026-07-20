"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { FileText, ChevronDown, ChevronUp, Play, BookOpen, Upload, AlertTriangle, Search, LayoutDashboard, Brain, Share2, PanelLeft, LayoutTemplate, Navigation, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECT_KEYS, SUBJECT_LABELS } from "@/lib/gemini-prompts";
import { SUBJECT_META } from "@/lib/subject-meta";
import { getExamProgram, type ExamProgram } from "@/lib/exam-program";
import { appendProgramToHref, useProgram } from "@/lib/use-program";
import { AP_SUBJECT_KEYS } from "@/lib/home-hero-content";
import { CONTACT_EMAIL } from "@/lib/site-config";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ExamSourceLine } from "@/components/exams/ExamSourceLine";

const SAT_SUBJECT_KEYS = SUBJECT_KEYS.filter((k) => getExamProgram(k) === "SAT");

function buildSubjects(program: ExamProgram) {
  const keys = program === "SAT" ? SAT_SUBJECT_KEYS : AP_SUBJECT_KEYS;
  return [
    { value: "", label: "All subjects" },
    ...keys.map((v) => ({ value: v, label: SUBJECT_LABELS[v] })),
  ];
}

interface PublishedExam {
  id: string;
  filename: string;
  subject: string;
  questionCount: number;
  ownerUsername: string;
  createdAt?: string;
  examKind?: "mcq" | "frq";
  sourceType?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

function publishedExamPath(exam: PublishedExam) {
  return exam.examKind === "frq" ? `/frq/${exam.id}` : `/exam/${exam.id}`;
}

export function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const router = useRouter();
  const { program } = useProgram();
  const isSat = program === "SAT";

  const [exams, setExams] = useState<PublishedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [howToOpen, setHowToOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [interfaceGuideOpen, setInterfaceGuideOpen] = useState(false);

  const SUBJECTS = buildSubjects(program);
  const programKeys = isSat ? SAT_SUBJECT_KEYS : AP_SUBJECT_KEYS;

  // Reset subject filter whenever the active program changes (e.g. the user
  // toggles AP/SAT in the global HeaderNav).
  useEffect(() => {
    setSubjectFilter("");
  }, [program]);

  const examsHref = appendProgramToHref("/exams", program);

  useEffect(() => {
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
      // Auth unavailable; exam list and public links still work.
    }
  }, []);

  useEffect(() => {
    // Cancellation guard: when program/subject changes quickly (e.g. AP<->SAT
    // toggle or the localStorage hydration on first load), a slow stale
    // response must not overwrite the list for the current selection.
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("program", program);
        if (subjectFilter) params.set("subject", subjectFilter);
        const url = `/api/exams/published?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setExams(res.ok ? (data.exams ?? []) : []);
      } catch {
        if (!cancelled) setExams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectFilter, program]);

  const subjectLabel = SUBJECTS.find((s) => s.value === subjectFilter)?.label ?? "All subjects";

  const handleSolveClick = (exam: PublishedExam) => {
    const path = publishedExamPath(exam);
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    router.push(path);
  };

  const isNewExam = (createdAt?: string) => {
    if (!createdAt) return false;
    const d = new Date(createdAt);
    const now = new Date();
    return now.getTime() - d.getTime() < 3 * 24 * 60 * 60 * 1000;
  };

  return (
    <>
      <main className="flex-1 mx-auto w-full max-w-4xl px-3 pb-6 sm:px-4 sm:pb-8">
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
                    {isSat ? (
                      <>
                        This is a general overview. SAT Reading &amp; Writing shows a passage on the left and a single question on the right; SAT Math shows a figure, equation, or table (or just a question stem). If the display looks wrong, use <strong>Show page</strong> to view the original question in the PDF.
                      </>
                    ) : (
                      <>
                        This is a general overview. The layout can vary by subject. For example, AP CSA shows code; Economics or Psychology may show graphs, tables, or passages. If the display looks wrong or unclear, use <strong>Show page</strong> to view the original question in the PDF.
                      </>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 mb-6">
                  <img
                    src="/exam-interface-preview.png"
                    alt="AP Practice Exam Online exam interface preview"
                    className="w-full h-auto object-contain max-h-[40vh] sm:max-h-[500px]"
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
                      {isSat ? (
                        <li><strong>Module title / Directions</strong> – Active SAT module (e.g. R&amp;W Module 1) and dropdown for instructions.</li>
                      ) : (
                        <li><strong>Section I / Directions</strong> – Current section and dropdown for instructions.</li>
                      )}
                      <li><strong>Timer & Hide</strong> – Countdown for remaining time; Hide to conceal the timer.</li>
                      <li><strong>Highlights & Notes</strong> – Highlight text or add personal notes.</li>
                      {isSat ? (
                        <li><strong>Desmos calculator</strong> – Built-in graphing calculator on SAT Math modules.</li>
                      ) : (
                        <li><strong>Reference</strong> – Access reference materials or documentation.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <PanelLeft className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold text-gray-900">
                        {isSat ? "Left Panel – Passage, Figures & Context" : "Left Panel – Graphs, Code & Context"}
                      </h3>
                    </div>
                    <ul className="space-y-1.5 text-gray-600">
                      {isSat ? (
                        <>
                          <li><strong>Purpose</strong> – Shows the SAT passage, table, figure, or equation for the current question. R&amp;W shows the source text; Math shows diagrams or data.</li>
                          <li><strong>Highlights</strong> – Highlight key sentences in the passage just like the real Bluebook.</li>
                          <li><strong>Show page</strong> – Opens the original PDF at the relevant page when you want to verify the question as printed.</li>
                        </>
                      ) : (
                        <>
                          <li><strong>Purpose</strong> – Shows graphs, tables, code, or passages depending on the subject. Economics may show supply/demand curves; AP CSA shows code; Psychology may show passages.</li>
                          <li><strong>Code segment</strong> – For AP CSA: introduces the code block to analyze.</li>
                          <li><strong>Graphs & tables</strong> – For subjects with visuals: displays charts, diagrams, or data tables.</li>
                          <li><strong>Show page</strong> – Opens the original PDF at the relevant page so you can verify the question as it appears in the source. Use this when the on-screen display looks wrong or unclear. You can scroll through all pages.</li>
                        </>
                      )}
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
                      {isSat ? (
                        <>
                          <li><strong>SAT badge</strong> – Indicates which SAT section and module you are in.</li>
                          <li><strong>Answers</strong> – Pick A–D for multiple-choice or enter a numeric value for grid-in (Student-Produced Response).</li>
                        </>
                      ) : (
                        <>
                          <li><strong>AP badge</strong> – Indicates Advanced Placement level or category.</li>
                          <li><strong>Multiple-choice options (A–E)</strong> – Select the correct answer; click the option to choose.</li>
                        </>
                      )}
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
                      {isSat ? (
                        <li><strong>Submit Module / End Exam</strong> – Finish the current SAT module to move on, or submit the full test at the end of Math Module 2 to see your scaled score (400–1600).</li>
                      ) : (
                        <li><strong>End Exam</strong> – Submit the exam and see your score (on the last question).</li>
                      )}
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
                        {isSat ? (
                          <>
                            View all published exams on this page. Use the subject dropdown to filter by SAT section (Reading &amp; Writing, Math, or Full Test). Click Solve on any exam to start.
                          </>
                        ) : (
                          <>
                            View all published exams on this page. Use the subject dropdown to filter by AP subject (e.g. AP Psychology, AP Calculus). Click Solve on any exam to start.
                          </>
                        )}
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
                        {isSat ? (
                          <>
                            <li className="pl-1">Pick the SAT subject (Reading &amp; Writing, Math, or Full Test).</li>
                            <li className="pl-1">For Full Test: choose adaptive mode (non-adaptive or six-module) and optional M1 cutoffs.</li>
                            <li className="pl-1">For single-module uploads: enter the question count.</li>
                            <li className="pl-1">Drag and drop or click to choose the PDF. The AI will detect MCQ vs grid-in automatically.</li>
                          </>
                        ) : (
                          <>
                            <li className="pl-1">Select the AP subject from the dropdown.</li>
                            <li className="pl-1">Enter the question count.</li>
                            <li className="pl-1">If your PDF has images, tables, or graphs, check the box.</li>
                            <li className="pl-1">Drag and drop or click to choose the file. The system will extract questions automatically.</li>
                          </>
                        )}
                      </ol>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <Play className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">Solve</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {isSat ? (
                          <>
                            Pick A–D for multiple-choice or type a numeric value for grid-in questions. Use Mark for Review to flag tough questions and the question grid to jump between them. Finish a module to advance to the next (R&amp;W M1 → M2 → Math M1 → M2). Submit at the end to see your scaled score (400–1600). SAT Math has a built-in Desmos calculator.
                          </>
                        ) : (
                          <>
                            Answer each question by selecting A, B, C, D, or E. Use Mark for Review to flag questions you want to revisit. Navigate with Previous/Next or the question grid. When finished, click End Exam to submit and see your score. The exam interface mimics the real Bluebook digital testing experience.
                          </>
                        )}
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
                <h2 className="text-base font-semibold text-gray-900">Warnings</h2>
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
                    <div>
                      {isSat
                        ? "This is not an official College Board, SAT, or Bluebook platform. We mimic the Digital SAT Bluebook experience for practice only."
                        : "This is not an official College Board or AP exam platform. We mimic the Bluebook digital exam experience for practice; for educational use only."}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <div>
                      {isSat
                        ? "The timer is optional and the displayed scaled score is an approximation. Real SAT scores depend on the College Board's adaptive routing and statistical equating."
                        : "The timer is optional and does not reflect official AP exam timing. Use it as a rough guide."}
                    </div>
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                  {programKeys.map((key) => (
                    <Link
                      key={key}
                      href={`/exams/${SUBJECT_META[key].slug}`}
                      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      {SUBJECT_LABELS[key].replace(/^AP /, "").replace(/^SAT /, "")}
                    </Link>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href={examsHref}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    View all {isSat ? "SAT" : "AP"} practice tests &rarr;
                  </Link>
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
                  {program === "SAT" ? (
                    <>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">What is AP Practice Exam Online SAT practice?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          A free Digital SAT practice platform mimicking the real Bluebook experience. Upload SAT PDFs (Reading & Writing, Math, or a full test) and solve adaptive modules with grid-in support and a built-in Desmos calculator.
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">How long is the Digital SAT?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          Approximately 2 hours 14 minutes: Reading & Writing (2 modules × 32 min, 27 questions each) followed by Math (2 modules × 35 min, 22 questions each).
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">Does this support grid-in questions?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          Yes. SAT Math grid-in (Student-Produced Response) questions are fully supported with a numeric input box and AI-graded answer checking.
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">Is there a built-in calculator?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          Yes. SAT Math modules embed the official Desmos graphing calculator, available throughout the section just like the real Digital SAT.
                        </dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">What is AP Practice Exam Online?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          A free platform that mimics the real College Board Bluebook digital exam experience. Practice AP exams with a familiar interface: upload PDFs, solve multiple-choice questions, and get instant scoring. AI can generate answer keys when your PDF has none.
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-gray-900">Is it free?</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                          Yes. AP Practice Exam Online mimics the real Bluebook experience and is free for educational use. Sign up to upload and publish exams.
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
                    </>
                  )}
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <Link href="/about" className="font-medium text-blue-600 hover:underline">
                        Learn more about AP Practice Exam Online
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
            <div className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSubjectOpen((o) => !o)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 sm:w-auto",
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
                  <div className="absolute left-0 right-0 z-20 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-auto sm:min-w-[220px]">
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
                        key={`${exam.examKind ?? "mcq"}-${exam.id}`}
                        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="h-8 w-8 shrink-0 text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900 truncate" title={exam.filename}>
                                {exam.filename}
                              </h3>
                              {exam.examKind === "frq" && (
                                <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
                                  FRQ
                                </span>
                              )}
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
                          {exam.sourceType && exam.sourceName ? (
                            <ExamSourceLine
                              className="block text-xs"
                              sourceType={exam.sourceType}
                              sourceName={exam.sourceName}
                              sourceUrl={exam.sourceUrl}
                            />
                          ) : null}
                          <p className="text-xs text-gray-500">
                            {exam.questionCount} questions
                          </p>
                          <p className="text-xs text-gray-500">
                            {exam.ownerUsername}
                          </p>
                        </div>
                        <div className="mt-4 space-y-2">
                          <button
                            type="button"
                            onClick={() => handleSolveClick(exam)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            <Play className="h-4 w-4" />
                            Solve
                          </button>
                          <ExamShareButton examId={exam.id} examKind={exam.examKind} />
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
                  key={`${exam.examKind ?? "mcq"}-${exam.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-8 w-8 shrink-0 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate" title={exam.filename}>
                          {exam.filename}
                        </h3>
                        {exam.examKind === "frq" && (
                          <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800">
                            FRQ
                          </span>
                        )}
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
                    {exam.sourceType && exam.sourceName ? (
                      <ExamSourceLine
                        className="block text-xs"
                        sourceType={exam.sourceType}
                        sourceName={exam.sourceName}
                        sourceUrl={exam.sourceUrl}
                      />
                    ) : null}
                    <p className="text-xs text-gray-500">
                      {exam.questionCount} questions
                    </p>
                    <p className="text-xs text-gray-500">
                      {exam.ownerUsername}
                    </p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => handleSolveClick(exam)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Play className="h-4 w-4" />
                      Solve
                    </button>
                    <ExamShareButton examId={exam.id} examKind={exam.examKind} />
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
                <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Practice tests
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/blog" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Blog
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
                  About
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/privacy" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Privacy
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/terms" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Terms
                </Link>
                <span className="text-gray-300">|</span>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                  Contact
                </a>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Dashboard
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Practice tests
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/blog" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Blog
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
                  About
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/privacy" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Privacy
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/terms" className="text-gray-600 hover:text-blue-600 hover:underline">
                  Terms
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
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-600 hover:text-blue-600 hover:underline">
                  Contact
                </a>
              </>
            )}
          </div>
          <p className="mt-3 text-center text-sm text-gray-600">
            If you encounter any issues, you can always email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
          <TrademarkDisclaimer variant="compact" className="mt-4 px-2" />
        </div>
      </footer>
    </>
  );
}
