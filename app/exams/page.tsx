import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { ALL_SUBJECTS, CATEGORY_LABELS, type SubjectCategory } from "@/lib/subject-meta";
import type { ExamProgram } from "@/lib/exam-program";
import { CONTACT_EMAIL, getSiteUrl, SITE_NAME } from "@/lib/site-config";

export const revalidate = 3600;

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Practice Tests - Free Digital Bluebook Practice (AP + SAT)",
  description:
    "Browse 24 AP exam practice tests and Digital SAT practice modules with a Bluebook-style interface. Free multiple-choice and grid-in questions with AI scoring.",
  alternates: { canonical: `${baseUrl}/exams` },
  openGraph: {
    title: `All Practice Tests | ${SITE_NAME}`,
    description:
      "Browse AP exam and Digital SAT practice tests with Bluebook-style digital interface. Free with AI scoring.",
    url: `${baseUrl}/exams`,
    type: "website",
    images: ["/og-image.png"],
  },
};

async function fetchPublishedCounts(): Promise<Record<string, number>> {
  try {
    const supabase = createServerSupabaseAdmin();
    const { data } = await supabase
      .from("pdf_uploads")
      .select("subject")
      .eq("is_published", true)
      .eq("moderation_status", "approved");
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const k = (row.subject as string) ?? "";
      if (!k) continue;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

const AP_CATEGORY_ORDER: SubjectCategory[] = [
  "math",
  "science",
  "cs",
  "economics",
  "history",
  "social",
  "english",
];
const SAT_CATEGORY_ORDER: SubjectCategory[] = ["sat"];

function parseProgram(value: string | string[] | undefined): ExamProgram {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase() === "sat" ? "SAT" : "AP";
}

interface ExamsIndexPageProps {
  searchParams?: Promise<{ program?: string | string[] }>;
}

export default async function ExamsIndexPage({ searchParams }: ExamsIndexPageProps) {
  const params = (await searchParams) ?? {};
  const program = parseProgram(params.program);
  const isSat = program === "SAT";

  const counts = await fetchPublishedCounts();

  const order = isSat ? SAT_CATEGORY_ORDER : AP_CATEGORY_ORDER;
  const grouped = order
    .map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      subjects: ALL_SUBJECTS.filter((s) => s.category === cat),
    }))
    .filter((g) => g.subjects.length > 0);

  const visibleSubjects = grouped.flatMap((g) => g.subjects);

  const programLabel = isSat ? "Digital SAT Practice Tests" : "AP Practice Tests";
  const heroTitle = isSat
    ? "All Digital SAT Practice Modules"
    : "All AP Exam Practice Tests";
  const heroDescription = isSat
    ? `Free Bluebook-style Digital SAT practice for Reading & Writing, Math, and full tests with adaptive Module 2, grid-in support, and a built-in Desmos calculator. Each module page lists community-published exams with instant AI scoring.`
    : `Free Bluebook-style digital practice for all ${visibleSubjects.length} Advanced Placement subjects. Each subject page includes the official exam format, covered topics, and community-published practice exams with instant AI scoring.`;
  const uploadHeading = isSat ? "Upload your own SAT PDF" : "Upload your own AP exam PDF";
  const uploadBody = isSat
    ? "Have a Digital SAT practice test or a section module PDF? Sign in, head to the dashboard, and upload it. Our AI detects MCQ vs grid-in, splits the modules, and gives you a Bluebook-style interface to practice in."
    : "Have a College Board released exam or a teacher-provided practice test? Sign in, head to the dashboard, and upload the PDF. Our AI extracts questions, generates an answer key, and gives you a Bluebook-style interface to practice in. Toggle \u201CPublish\u201D to share with other students.";

  const programQuery = isSat ? "?program=sat" : "";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: programLabel,
        item: `${baseUrl}/exams${programQuery}`,
      },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: visibleSubjects.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.fullName} Practice Test`,
      url: `${baseUrl}/exams/${s.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-gray-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href={`/${programQuery}`} className="hover:text-blue-600 hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-gray-700">{programLabel}</li>
          </ol>
        </nav>

        <section className="mb-8 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-4 py-8 shadow-sm border border-gray-100 text-center sm:px-6 sm:py-10">
          <BookOpen className="mx-auto h-10 w-10 text-blue-600 sm:h-12 sm:w-12" />
          <h1 className="mt-3 text-xl font-semibold text-gray-900 sm:text-2xl">{heroTitle}</h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">{heroDescription}</p>
        </section>

        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.cat}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {group.label}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({group.subjects.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.subjects.map((s) => {
                  const count = counts[s.key] ?? 0;
                  return (
                    <Link
                      key={s.key}
                      href={`/exams/${s.slug}${programQuery}`}
                      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex flex-col sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <BookOpen className="h-7 w-7 shrink-0 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 leading-snug line-clamp-2">{s.fullName}</h3>
                          <p className="mt-1 text-xs text-gray-500">
                            {s.examFormat.mcqCount} MCQ &middot; {s.examFormat.durationMin} min
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-gray-600 line-clamp-3">{s.intro}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-600">
                          {count > 0
                            ? `${count} published exam${count !== 1 ? "s" : ""}`
                            : "Be the first to upload"}
                        </span>
                        <span className="text-xs text-gray-400">View &rarr;</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-base font-semibold text-gray-900">{uploadHeading}</h2>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">{uploadBody}</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign up free
            </Link>
            <Link
              href={`/about${programQuery}`}
              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Learn how it works
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href={`/${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
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
