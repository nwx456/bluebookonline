import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { ALL_SUBJECTS, CATEGORY_LABELS, type SubjectCategory } from "@/lib/subject-meta";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";

export const metadata: Metadata = {
  title: "All AP Exam Practice Tests - Free Digital Bluebook Practice",
  description:
    "Browse all 24 AP exam practice tests with Bluebook-style digital interface. Free multiple-choice questions with AI scoring for AP Calculus, Biology, Psychology, US History, and more.",
  alternates: { canonical: `${baseUrl}/exams` },
  openGraph: {
    title: "All AP Exam Practice Tests | Bluebook Online",
    description:
      "Browse all 24 AP exam practice tests with Bluebook-style digital interface. Free multiple-choice questions with AI scoring.",
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
      .eq("is_published", true);
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

const CATEGORY_ORDER: SubjectCategory[] = [
  "math",
  "science",
  "cs",
  "economics",
  "history",
  "social",
  "english",
];

export default async function ExamsIndexPage() {
  const counts = await fetchPublishedCounts();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    subjects: ALL_SUBJECTS.filter((s) => s.category === cat),
  })).filter((g) => g.subjects.length > 0);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "AP Practice Tests", item: `${baseUrl}/exams` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: ALL_SUBJECTS.map((s, i) => ({
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
            <li className="font-medium text-gray-700">AP Practice Tests</li>
          </ol>
        </nav>

        <section className="mb-8 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-blue-600" />
          <h1 className="mt-3 text-2xl font-semibold text-gray-900 sm:text-3xl">
            All AP Exam Practice Tests
          </h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Free Bluebook-style digital practice for all {ALL_SUBJECTS.length} Advanced Placement
            subjects. Each subject page includes the official exam format, covered topics, and
            community-published practice exams with instant AI scoring.
          </p>
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
                      href={`/exams/${s.slug}`}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex flex-col"
                    >
                      <div className="flex items-start gap-3">
                        <BookOpen className="h-7 w-7 shrink-0 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 leading-snug">{s.fullName}</h3>
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
          <h2 className="text-base font-semibold text-gray-900">Upload your own AP exam PDF</h2>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed">
            Have a College Board released exam or a teacher-provided practice test? Sign in, head to
            the dashboard, and upload the PDF. Our AI extracts questions, generates an answer key,
            and gives you a Bluebook-style interface to practice in. Toggle &ldquo;Publish&rdquo; to
            share with other students.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign up free
            </Link>
            <Link
              href="/about"
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
            <Link href="/" className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
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
            Not affiliated with College Board. For educational practice only.
          </p>
        </div>
      </footer>
    </div>
  );
}
