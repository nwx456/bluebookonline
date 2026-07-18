import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { BookOpen, Brain, FileText, Sparkles, Shield, Users } from "lucide-react";
import { ALL_SUBJECTS } from "@/lib/subject-meta";
import type { ExamProgram } from "@/lib/exam-program";
import { CONTACT_EMAIL, getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "About",
  description:
    `${SITE_NAME} mimics the real College Board Bluebook exam. Free AP and Digital SAT practice for students worldwide. Learn how the platform works and how AI scoring is built.`,
  alternates: { canonical: `${baseUrl}/about` },
};

const ABOUT_FAQ_AP = [
  {
    q: "Is AP Practice Exam Online affiliated with College Board?",
    a: "No. AP Practice Exam Online is an independent educational tool. We are not endorsed by, sponsored by, or connected with College Board, AP, or the official Bluebook application. The interface is designed to feel familiar so practice translates well to test day.",
  },
  {
    q: "Is the platform really free?",
    a: "Yes. All core features (uploading PDFs, solving exams, AI scoring, AI explanations, publishing exams) are free. We may eventually offer paid features such as advanced analytics, but the practice tools will remain free for students.",
  },
  {
    q: "Which AP subjects are supported?",
    a: "All 24 AP subjects with multiple-choice sections, including Calculus AB, Calculus BC, Biology, Chemistry, Physics 1 and 2, Physics C, Statistics, US History, World History, European History, Psychology, Microeconomics, Macroeconomics, US Government, Comparative Government, Human Geography, English Language, English Literature, Computer Science A, Computer Science Principles, Environmental Science, and Precalculus.",
  },
  {
    q: "How accurate is AI scoring?",
    a: "AI scoring is highly accurate for clearly written multiple-choice questions but is not perfect. Subjects with heavy diagrams, complex code, or ambiguous wording are more error-prone. Always verify high-stakes answers with an official source.",
  },
  {
    q: "What happens to my uploaded PDFs?",
    a: "Your PDFs are stored privately by default. They become visible to other users only when you toggle Publish on the dashboard. You can unpublish or delete uploads at any time.",
  },
  {
    q: "Can teachers use AP Practice Exam Online?",
    a: "Yes. Teachers commonly upload released exams, publish them, and share the link with their class so students get a digital practice run.",
  },
  {
    q: "Does the timer match the official exam?",
    a: "The timer is a rough guide. Some AP exams have changed format recently, and the timer is not a substitute for official testing conditions. Use it for pacing practice.",
  },
  {
    q: "Which AI models are used?",
    a: "We use Google Gemini as the primary model with automatic fallback across multiple model versions for resilience. Claude is supported as an alternate provider for PDF analysis.",
  },
];

const ABOUT_FAQ_SAT = [
  {
    q: "Is AP Practice Exam Online affiliated with College Board?",
    a: "No. AP Practice Exam Online is an independent educational tool. We are not endorsed by, sponsored by, or connected with College Board, SAT, or the official Bluebook application. The interface mimics Bluebook so practice transfers well to test day.",
  },
  {
    q: "What SAT formats are supported?",
    a: "SAT Reading & Writing modules, SAT Math modules (with built-in Desmos graphing calculator), and full Digital SAT tests (4 modules). Adaptive Module 2 routing is supported in two modes: non-adaptive and six-module (M2 easy + M2 hard variants).",
  },
  {
    q: "Are grid-in (Student-Produced Response) questions supported?",
    a: "Yes. SAT Math grid-in questions get a dedicated numeric input with a keypad, decimal and fraction support, and tolerance-aware grading.",
  },
  {
    q: "How is the SAT score calculated?",
    a: "Section scores (Reading & Writing and Math) are approximated on a 200–800 scale using your raw correct counts; the composite is a 400–1600 total. This is an approximation of the College Board scoring algorithm and not the official equating.",
  },
  {
    q: "Can teachers use AP Practice Exam Online for SAT prep?",
    a: "Yes. Teachers upload SAT practice PDFs, publish them, and share the link so students get a Bluebook-style digital practice run with instant AI scoring and explanations.",
  },
  {
    q: "Which AI models are used?",
    a: "Google Gemini is the primary model with multi-version fallback. Claude is supported as a backup provider for PDF analysis on busy days.",
  },
];

function parseProgram(value: string | string[] | undefined): ExamProgram {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase() === "sat" ? "SAT" : "AP";
}

interface AboutPageProps {
  searchParams?: Promise<{ program?: string | string[] }>;
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const sp = (await searchParams) ?? {};
  const program = parseProgram(sp.program);
  const isSat = program === "SAT";
  const programQuery = isSat ? "?program=sat" : "";

  const FAQ = isSat ? ABOUT_FAQ_SAT : ABOUT_FAQ_AP;

  const visibleSubjects = ALL_SUBJECTS.filter((s) =>
    isSat ? s.category === "sat" : s.category !== "sat"
  );

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 space-y-8">
        <section className="rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">About AP Practice Exam Online</h1>
          <p className="mt-4 text-gray-600 leading-relaxed">
            {isSat ? (
              <>
                AP Practice Exam Online is a free educational platform that mimics the official College
                Board Digital SAT Bluebook experience. Students practice the SAT by uploading PDFs
                and solving multiple-choice and grid-in questions module by module, with adaptive
                Module 2 routing and a built-in Desmos calculator on Math. The interface is modeled
                on the real Bluebook app so practice transfers cleanly to test day.
              </>
            ) : (
              <>
                AP Practice Exam Online is a free educational platform that mimics the official College
                Board Bluebook digital exam experience. Students practice AP exams by uploading
                PDFs, solving multiple-choice questions, and receiving instant AI-powered scoring.
                The interface and navigation are modeled on the real Bluebook app so practice
                transfers cleanly to test day.
              </>
            )}
          </p>
          <TrademarkDisclaimer variant="callout" className="mt-6" />
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Why we built this</h2>
          {isSat ? (
            <>
              <p className="mt-3 text-gray-600 leading-relaxed">
                The Digital SAT runs entirely inside the College Board Bluebook application. Many
                students walk in having never practiced inside that interface and lose time learning
                the layout instead of answering questions. AP Practice Exam Online gives every student a free
                way to drill SAT modules in a Bluebook-style environment.
              </p>
              <p className="mt-3 text-gray-600 leading-relaxed">
                We focus on the parts students struggle with at the actual SAT: navigating modules,
                marking questions for review, grid-in entry, and using the Desmos calculator inside
                Math. The platform handles question extraction, MCQ vs grid-in detection, and
                scaled-score approximation so you can focus on pacing and content.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-gray-600 leading-relaxed">
                The College Board moved AP exams to digital delivery through the Bluebook
                application. Many students walk into the real test having never seen the digital
                interface. Tutoring centers and prep books charge for tools that approximate the
                experience. AP Practice Exam Online exists to give every student, anywhere in the world, a
                free way to practice AP multiple-choice questions in a Bluebook-style environment.
              </p>
              <p className="mt-3 text-gray-600 leading-relaxed">
                We focus on the parts students actually struggle with: navigating the interface,
                managing time across questions, marking questions for review, and getting fast
                feedback on what they got wrong. Everything else (mock essays, video lessons, large
                question banks) is already covered by other platforms; we stay focused on the exam
                interface and AI feedback layer.
              </p>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">How AI scoring works</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <FileText className="h-5 w-5" />
                <h3 className="text-sm font-semibold">1. PDF analysis</h3>
              </div>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                {isSat ? (
                  <>
                    When you upload a PDF, Gemini reads the document, splits SAT modules, detects
                    MCQ vs grid-in, and extracts every question with its options or numeric prompt.
                  </>
                ) : (
                  <>
                    When you upload a PDF, Gemini reads the document and extracts every
                    multiple-choice question, its options, and any associated graph, code, or
                    passage region.
                  </>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Brain className="h-5 w-5" />
                <h3 className="text-sm font-semibold">2. Answer key generation</h3>
              </div>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                If your PDF has no answer key, the first attempt asks AI to generate one. The key is
                saved permanently, so the next student to solve the same exam reuses it without
                burning AI cost.
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-sm font-semibold">3. Explanations on demand</h3>
              </div>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                On the results screen, every wrong answer can be expanded for an AI-written
                explanation grounded in the original PDF page. Click once and the reasoning loads.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 leading-relaxed">
            Resilience: we use a fallback chain across multiple Gemini model versions so a single
            model outage does not block your exam. If Gemini is fully unavailable, the system can
            optionally switch to Claude for PDF analysis.
          </p>
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Is AI scoring accurate?</h2>
          <p className="mt-3 text-gray-600 leading-relaxed">
            AI multiple-choice scoring is highly reliable for cleanly worded questions but is not
            infallible. We are honest about its limits:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              {isSat
                ? "SAT Math questions with complex figures or diagrams carry more risk of extraction errors."
                : "Subjects with heavy diagrams (Physics, Chemistry, Calculus FRQs) carry more risk of extraction errors."}
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              Low-resolution scans, skewed pages, and handwritten answers reduce accuracy.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              The &ldquo;Show page&rdquo; button always opens the original PDF page so you can
              verify the question as printed.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              For high-stakes review, cross-check answers against the official answer key when one
              exists.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isSat
              ? `Supported SAT sections (${visibleSubjects.length})`
              : `Supported AP subjects (${visibleSubjects.length})`}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isSat
              ? "Each section has its own dedicated practice page with module timings, scaled scoring, and community-published mock tests."
              : "Each subject has its own dedicated practice page with exam format, topics covered, and community-published mock tests."}
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {visibleSubjects.map((s) => (
              <Link
                key={s.key}
                href={`/exams/${s.slug}${programQuery}`}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span className="truncate">{s.fullName}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Privacy and trust</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Shield className="h-5 w-5" />
                <h3 className="text-sm font-semibold text-gray-900">Your uploads are private by default</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                PDFs are stored privately. They appear on the public exams page only after you
                explicitly toggle Publish. You can unpublish or delete at any time. See our{" "}
                <a href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Users className="h-5 w-5" />
                <h3 className="text-sm font-semibold text-gray-900">Built by and for students</h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {isSat
                  ? "The platform is maintained by a small team focused on AP and SAT test prep. We respond to bug reports and feature requests directly via email."
                  : "The platform is maintained by a small team focused on AP test prep. We respond to bug reports and feature requests directly via email."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Frequently asked questions</h2>
          <dl className="mt-4 space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-semibold text-gray-900">{f.q}</dt>
                <dd className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl bg-white px-6 py-8 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-sm text-gray-600">
            Questions, feedback, or bug reports? Email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We read every message.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href={`/${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`/exams${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Practice tests
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`/blog${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Blog
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`/about${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 hover:underline">
              Dashboard
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
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gray-600 hover:text-blue-600 hover:underline"
            >
              Contact
            </a>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600">
            If you encounter any issues, you can always email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
