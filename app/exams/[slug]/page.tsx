import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, FileText, ListChecks, CalendarDays, Calculator, Newspaper } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { PublishedExamsList } from "@/components/exams/PublishedExamsList";
import { SubjectHeroCta } from "@/components/exams/SubjectHeroCta";
import {
  ALL_SUBJECTS,
  SUBJECT_BY_SLUG,
  CATEGORY_LABELS,
  getRelatedSubjects,
} from "@/lib/subject-meta";

import type { ExamProgram } from "@/lib/exam-program";
import { CONTACT_EMAIL, getSiteUrl, SITE_NAME } from "@/lib/site-config";

export const revalidate = 3600;

const baseUrl = getSiteUrl();

export function generateStaticParams() {
  return ALL_SUBJECTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = SUBJECT_BY_SLUG[slug];
  if (!meta) return { title: "Subject not found" };

  const title = `${meta.fullName} Practice Test - Free Digital Exams`;
  const description = meta.description;
  const url = `${baseUrl}/exams/${meta.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      type: "website",
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

export default async function SubjectLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ program?: string | string[] }>;
}) {
  const { slug } = await params;
  const meta = SUBJECT_BY_SLUG[slug];
  if (!meta) notFound();

  const isSat = meta.category === "sat";
  const sp = (await searchParams) ?? {};
  const programParamRaw = Array.isArray(sp.program) ? sp.program[0] : sp.program;
  const programParam =
    programParamRaw?.toLowerCase() === "sat" || isSat ? "sat" : "ap";
  const programQuery = programParam === "sat" ? "?program=sat" : "";
  const homeHref = isSat ? "/sat" : "/";

  const programLabel = isSat ? "Digital SAT" : "Advanced Placement";
  const indexBreadcrumbLabel = isSat ? "Digital SAT Practice Tests" : "AP Practice Tests";
  const indexHref = `/exams${programQuery}`;

  const related = getRelatedSubjects(meta, 4);
  const url = `${baseUrl}/exams/${meta.slug}`;

  const courseJsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${meta.fullName} Practice Test`,
    description: meta.description,
    url,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      sameAs: baseUrl,
    },
    educationalLevel: programLabel,
    learningResourceType: "Practice exam",
    inLanguage: "en",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: isSat ? `${baseUrl}/sat` : baseUrl,
      },
      { "@type": "ListItem", position: 2, name: indexBreadcrumbLabel, item: `${baseUrl}/exams` },
      { "@type": "ListItem", position: 3, name: meta.fullName, item: url },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-gray-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href={homeHref} className="hover:text-blue-600 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={indexHref} className="hover:text-blue-600 hover:underline">
                {indexBreadcrumbLabel}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-gray-700">{meta.fullName}</li>
          </ol>
        </nav>

        <section className="mb-8 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {CATEGORY_LABELS[meta.category]}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {programLabel}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            {meta.fullName} Practice Test
          </h1>
          <p className="mt-3 text-gray-600 leading-relaxed">{meta.intro}</p>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            {isSat ? (
              <>
                Practice {meta.fullName} in a digital interface modeled on the real College Board
                Digital SAT Bluebook app. Upload your own PDF or solve a published mock test, with
                instant AI scoring, grid-in support, and a built-in Desmos calculator on Math. Free
                for all students.
              </>
            ) : (
              <>
                Practice {meta.fullName} multiple-choice questions in a digital interface modeled on
                the real College Board Bluebook exam. Upload your own PDF or solve a published mock
                test, then get instant AI scoring and detailed answer explanations. Free for all
                students.
              </>
            )}
          </p>
          {meta.examDate2026 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
              <CalendarDays className="h-3.5 w-3.5" />
              2026 exam date: {meta.examDate2026}
            </div>
          )}
          <SubjectHeroCta />
        </section>

        {meta.relatedBlogSlug && (
          <section className="mb-8">
            <Link
              href={`/blog/${meta.relatedBlogSlug}`}
              className="block rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-blue-100">
                  <Newspaper className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Complete Guide</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    Read the {meta.fullName} complete study guide
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Exam format, unit-by-unit breakdown, top FAQs from r/APStudents, study timeline, and study resources.
                  </p>
                </div>
                <span className="text-blue-600 text-sm font-medium hidden sm:inline">Read &rarr;</span>
              </div>
            </Link>
          </section>
        )}

        <section className="mb-8">
          <Link
            href={
              isSat
                ? "/tools/sat-score-calculator"
                : `/tools/ap-score-calculator/${meta.slug}`
            }
            className="block rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-emerald-100">
                <Calculator className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Score Calculator</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  Estimate your {isSat ? "Digital SAT" : meta.fullName} score
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {isSat
                    ? "Enter module-level practice results to predict Reading & Writing, Math, and total 400–1600."
                    : "Enter MCQ and FRQ practice scores to predict your 1–5 AP score from official section weights."}
                </p>
              </div>
              <span className="text-emerald-600 text-sm font-medium hidden sm:inline">Calculate &rarr;</span>
            </div>
          </Link>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Exam format</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <ListChecks className="h-5 w-5" />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Multiple-choice
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {meta.examFormat.mcqCount}
              </p>
              <p className="text-sm text-gray-600">questions</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <Clock className="h-5 w-5" />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {meta.examFormat.totalDurationMin ? "Total duration" : "Section I duration"}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {meta.examFormat.totalDurationMin ?? meta.examFormat.durationMin}
              </p>
              <p className="text-sm text-gray-600">minutes</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <FileText className="h-5 w-5" />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Mode
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-900 leading-snug capitalize">
                {meta.examFormat.examMode
                  ? meta.examFormat.examMode === "fully-digital"
                    ? "Fully digital (Bluebook app)"
                    : "Hybrid digital (MCQ digital + paper FRQ)"
                  : "Bluebook digital exam"}
              </p>
            </div>
          </div>

          {meta.examFormat.sectionsDetail && meta.examFormat.sectionsDetail.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Section</th>
                    <th className="px-4 py-2.5 text-right font-medium">Questions</th>
                    <th className="px-4 py-2.5 text-right font-medium">Time</th>
                    <th className="px-4 py-2.5 text-right font-medium">Score weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {meta.examFormat.sectionsDetail.map((s) => (
                    <tr key={s.label} className="text-gray-700">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.label}</div>
                        {s.notes && <div className="mt-0.5 text-xs text-gray-500">{s.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.questionCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.durationMin} min</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.weightPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(meta.examFormat.calculatorPolicy || meta.examFormat.referenceMaterials) && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {meta.examFormat.calculatorPolicy && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-sm flex gap-2">
                  <Calculator className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Calculator: </span>
                    {meta.examFormat.calculatorPolicy}
                  </div>
                </div>
              )}
              {meta.examFormat.referenceMaterials && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-sm flex gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Reference: </span>
                    {meta.examFormat.referenceMaterials}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {meta.units && meta.units.length > 0 ? "Course units and exam weights" : "Topics covered"}
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            {meta.units && meta.units.length > 0 ? (
              <ul className="space-y-2">
                {meta.units.map((u) => (
                  <li
                    key={u.name}
                    className="flex items-start justify-between gap-3 text-sm text-gray-700 border-b border-gray-50 last:border-0 pb-2 last:pb-0"
                  >
                    <span className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      {u.name}
                    </span>
                    {u.weight && (
                      <span className="shrink-0 text-xs font-medium text-blue-700 tabular-nums">
                        {u.weight}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {meta.topics.map((topic) => (
                  <li
                    key={topic}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {topic}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Source:{" "}
              {isSat ? (
                <a
                  href="https://satsuite.collegeboard.org/sat"
                  className="underline hover:text-blue-600"
                  rel="nofollow noopener"
                  target="_blank"
                >
                  College Board SAT Suite
                </a>
              ) : (
                <a
                  href="https://apstudents.collegeboard.org"
                  className="underline hover:text-blue-600"
                  rel="nofollow noopener"
                  target="_blank"
                >
                  College Board AP Students
                </a>
              )}{" "}
              {isSat ? "test specifications." : "Course and Exam Description."}
            </p>
          </div>
        </section>

        <PublishedExamsList
          subjectKey={meta.key}
          subjectFullName={meta.fullName}
          subjectShortName={meta.shortName}
        />

        <section id="how-ai-works" className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">How AI scoring works</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              When you upload an {meta.fullName} PDF without an answer key, our system uses Google
              Gemini to read the document, extract every multiple-choice question, and generate the
              correct answers. The first attempt seeds the answer key; later attempts use the saved
              key, so AI runs only once per exam.
            </p>
            <p>
              Each question is scored against the stored key in real time. After you submit, you can
              review every wrong answer with an AI-written explanation that grounds the reasoning in
              the original PDF page.
            </p>
            <p className="text-xs text-gray-500">
              AI-generated keys may have errors. Always cross-check answers against an official source
              for high-stakes review.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {meta.shortName} FAQ
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <dl className="space-y-5">
              {meta.faqs.map((f) => (
                <div key={f.q}>
                  <dt className="text-sm font-semibold text-gray-900">{f.q}</dt>
                  <dd className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              {isSat
                ? `Other ${CATEGORY_LABELS[meta.category]} sections`
                : `Other ${CATEGORY_LABELS[meta.category]} AP exams`}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map((r) => (
                <Link
                  key={r.key}
                  href={`/exams/${r.slug}${programQuery}`}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex items-center gap-2 text-sm"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-gray-700 font-medium truncate">{r.fullName}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                href={indexHref}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {isSat
                  ? "Browse all Digital SAT practice tests"
                  : "Browse all 24 AP practice tests"}
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href={`/${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={indexHref} className="text-gray-600 hover:text-blue-600 hover:underline">
              All practice tests
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`/about${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Contact
            </a>
          </div>
          <TrademarkDisclaimer variant="compact" className="mt-3 px-2" />
        </div>
      </footer>
    </div>
  );
}
