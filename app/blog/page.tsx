import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Calendar } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_CATEGORIES, formatBlogDate, getAllPostMeta } from "@/lib/blog";
import type { ExamProgram } from "@/lib/exam-program";
import { CONTACT_EMAIL, getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Blog - AP & Digital SAT Tips, Bluebook Guides, Study Strategies",
  description:
    "Guides for all 24 AP subjects: study guides, score calculators, digital Bluebook tips, and exam strategies backed by official College Board resources.",
  alternates: { canonical: `${baseUrl}/blog` },
  openGraph: {
    title: `Blog | ${SITE_NAME}`,
    description:
      "Practical guides for AP and SAT students: digital Bluebook exam strategies, study tips, and subject-specific advice.",
    url: `${baseUrl}/blog`,
    type: "website",
    images: ["/og-image.png"],
  },
};

function parseProgram(value: string | string[] | undefined): ExamProgram {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase() === "sat" ? "SAT" : "AP";
}

interface BlogIndexPageProps {
  searchParams?: Promise<{ program?: string | string[]; category?: string | string[] }>;
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const sp = (await searchParams) ?? {};
  const program = parseProgram(sp.program);
  const isSat = program === "SAT";
  const programQuery = isSat ? "?program=sat" : "";

  const categoryRaw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const activeCategory =
    categoryRaw && BLOG_CATEGORIES.includes(categoryRaw as (typeof BLOG_CATEGORIES)[number])
      ? (categoryRaw as (typeof BLOG_CATEGORIES)[number])
      : null;

  const allPosts = isSat ? [] : getAllPostMeta();
  const posts = activeCategory
    ? allPosts.filter((p) => p.category === activeCategory)
    : allPosts;

  const heroTitle = isSat ? "Digital SAT Prep Blog" : "AP Exam Prep Blog";
  const heroSubtitle = isSat
    ? "Practical guides for the Digital SAT: Bluebook strategies, Module 2 adaptive routing, grid-in pacing, and Desmos tips. Fresh posts coming soon."
    : "Complete guides for all 24 AP subjects, free score calculators, digital Bluebook strategies, and official College Board study resources.";

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE_NAME} Blog`,
    description: isSat
      ? "Digital SAT prep guides and Bluebook-app strategies."
      : "Guides and study strategies for AP students preparing for the digital Bluebook exam.",
    url: `${baseUrl}/blog${programQuery}`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: baseUrl,
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      url: `${baseUrl}/blog/${p.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <section className="mb-10 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{heroTitle}</h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">{heroSubtitle}</p>
        </section>

        {!isSat && (
          <nav
            aria-label="Blog categories"
            className="mb-8 flex flex-wrap gap-2 justify-center"
          >
            <Link
              href="/blog"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !activeCategory
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
              }`}
            >
              All
            </Link>
            {BLOG_CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/blog?category=${encodeURIComponent(cat)}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {cat}
              </Link>
            ))}
          </nav>
        )}

        {posts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-14 text-center shadow-sm">
            <BookOpen className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">
              {isSat
                ? "SAT blog content is coming soon"
                : activeCategory
                  ? `No posts in "${activeCategory}" yet`
                  : "No posts yet"}
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              {isSat
                ? "We are working on Digital SAT prep guides. In the meantime, jump into a SAT practice test or switch back to AP posts using the toggle in the header."
                : activeCategory
                  ? "Try another category or browse all posts."
                  : "We are working on the first batch of guides. Check back soon, or browse our practice tests in the meantime."}
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-center">
              <Link
                href={`/exams${programQuery}`}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {isSat ? "Browse SAT practice tests" : "Browse practice tests"}
              </Link>
              {(isSat || activeCategory) && (
                <Link
                  href="/blog"
                  className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {isSat ? "View AP blog posts" : "View all posts"}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex flex-col"
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatBlogDate(p.date)}
                  {p.category && (
                    <>
                      <span className="text-gray-400">&middot;</span>
                      <span className="text-blue-600 font-medium">{p.category}</span>
                    </>
                  )}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900 leading-snug">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {p.description}
                </p>
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-4 text-xs font-medium text-blue-600">Read more &rarr;</span>
              </Link>
            ))}
          </div>
        )}
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
            <Link href="/tools/ap-score-calculator" className="text-gray-600 hover:text-blue-600 hover:underline">
              Score calculator
            </Link>
            <span className="text-gray-300">|</span>
            <Link href={`/about${programQuery}`} className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gray-600 hover:text-blue-600 hover:underline"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
