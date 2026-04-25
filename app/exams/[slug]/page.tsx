import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, FileText, ListChecks, Play, Sparkles, CalendarDays, Calculator, Newspaper } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  ALL_SUBJECTS,
  SUBJECT_BY_SLUG,
  CATEGORY_LABELS,
  getRelatedSubjects,
  type SubjectMeta,
} from "@/lib/subject-meta";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";

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
      title: `${title} | Bluebook Online`,
      description,
      url,
      type: "website",
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Bluebook Online`,
      description,
    },
  };
}

interface PublishedExam {
  id: string;
  filename: string;
  questionCount: number;
  ownerUsername: string;
  createdAt?: string;
}

async function fetchPublishedExamsForSubject(meta: SubjectMeta): Promise<PublishedExam[]> {
  try {
    const supabase = createServerSupabaseAdmin();
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, user_email, created_at")
      .eq("is_published", true)
      .eq("subject", meta.key)
      .order("created_at", { ascending: false })
      .limit(12);

    const uploadList = uploads ?? [];
    if (uploadList.length === 0) return [];

    const emails = [...new Set(uploadList.map((u) => u.user_email).filter(Boolean))] as string[];
    let usernameMap: Record<string, string> = {};
    if (emails.length > 0) {
      const { data: users } = await supabase
        .from("usertable")
        .select("email, username")
        .in("email", emails);
      usernameMap = Object.fromEntries(
        (users ?? []).map((u) => [u.email, (u.username as string)?.trim() || "Anonymous"])
      );
    }

    const ids = uploadList.map((u) => u.id);
    const { data: counts } = await supabase
      .from("questions")
      .select("upload_id")
      .in("upload_id", ids);
    const countByUpload: Record<string, number> = {};
    for (const c of counts ?? []) {
      const u = c.upload_id as string;
      countByUpload[u] = (countByUpload[u] ?? 0) + 1;
    }

    return uploadList.map((u) => ({
      id: u.id as string,
      filename: (u.filename as string) ?? "PDF",
      questionCount: countByUpload[u.id as string] ?? 0,
      ownerUsername: usernameMap[u.user_email as string] ?? "Anonymous",
      createdAt: u.created_at as string | undefined,
    }));
  } catch (err) {
    console.error("Subject page published fetch error:", err);
    return [];
  }
}

export default async function SubjectLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = SUBJECT_BY_SLUG[slug];
  if (!meta) notFound();

  const exams = await fetchPublishedExamsForSubject(meta);
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
      name: "Bluebook Online",
      sameAs: baseUrl,
    },
    educationalLevel: "Advanced Placement",
    learningResourceType: "Practice exam",
    inLanguage: "en",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "AP Practice Tests", item: `${baseUrl}/exams` },
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

      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-gray-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-blue-600 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/exams" className="hover:text-blue-600 hover:underline">
                AP Practice Tests
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
              Advanced Placement
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            {meta.fullName} Practice Test
          </h1>
          <p className="mt-3 text-gray-600 leading-relaxed">{meta.intro}</p>
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">
            Practice {meta.fullName} multiple-choice questions in a digital interface modeled on the
            real College Board Bluebook exam. Upload your own PDF or solve a published mock test, then
            get instant AI scoring and detailed answer explanations. Free for all students.
          </p>
          {meta.examDate2026 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
              <CalendarDays className="h-3.5 w-3.5" />
              2026 exam date: {meta.examDate2026}
            </div>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Sparkles className="h-4 w-4" />
              Sign up free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Already have an account? Sign in
            </Link>
          </div>
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
              Source: <a href="https://apstudents.collegeboard.org" className="underline hover:text-blue-600" rel="nofollow noopener" target="_blank">College Board AP Students</a> Course and Exam Description.
            </p>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Published {meta.fullName} practice exams
            </h2>
            <span className="text-sm text-gray-500">
              {exams.length} {exams.length === 1 ? "exam" : "exams"}
            </span>
          </div>
          {exams.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900">
                No published {meta.shortName} exams yet
              </h3>
              <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                Be the first to upload and share an {meta.fullName} practice test. Sign in to upload
                your own PDF; AI will extract the questions automatically.
              </p>
              <Link
                href="/signup"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Upload the first exam
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
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
              Other {CATEGORY_LABELS[meta.category]} AP exams
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map((r) => (
                <Link
                  key={r.key}
                  href={`/exams/${r.slug}`}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex items-center gap-2 text-sm"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-gray-700 font-medium truncate">{r.fullName}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/exams"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Browse all 24 AP practice tests
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/" className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">
              All practice tests
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <a href="mailto:info@apbluebookonline.com" className="text-gray-600 hover:text-blue-600 hover:underline">
              Contact
            </a>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Not affiliated with College Board. Bluebook Online is an independent educational tool.
          </p>
        </div>
      </footer>
    </div>
  );
}
