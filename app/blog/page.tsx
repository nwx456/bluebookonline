import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Calendar } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { formatBlogDate, getAllPostMeta } from "@/lib/blog";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";

export const metadata: Metadata = {
  title: "Blog - AP Exam Tips, Bluebook Guides, and Study Strategies",
  description:
    "Practical guides for AP students: how to prepare for the digital Bluebook exam, study strategies for AP Calculus, Biology, Psychology, and more.",
  alternates: { canonical: `${baseUrl}/blog` },
  openGraph: {
    title: "Blog | Bluebook Online",
    description:
      "Practical guides for AP students: how to prepare for the digital Bluebook exam, study strategies, and subject-specific tips.",
    url: `${baseUrl}/blog`,
    type: "website",
    images: ["/og-image.png"],
  },
};

export default function BlogIndexPage() {
  const posts = getAllPostMeta();

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Bluebook Online Blog",
    description:
      "Guides and study strategies for AP students preparing for the digital Bluebook exam.",
    url: `${baseUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Bluebook Online",
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

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <section className="mb-10 rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-6 py-10 shadow-sm border border-gray-100 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            AP Exam Prep Blog
          </h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Practical guides for AP students: digital Bluebook exam strategies, subject-specific
            study tips, and how to use AI tools responsibly during prep.
          </p>
        </section>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-14 text-center shadow-sm">
            <BookOpen className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">No posts yet</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              We are working on the first batch of guides. Check back soon, or browse our practice
              tests in the meantime.
            </p>
            <Link
              href="/exams"
              className="mt-5 inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Browse practice tests
            </Link>
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
                  {p.author && <span className="text-gray-400">&middot; {p.author}</span>}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-gray-900 leading-snug">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {p.description}
                </p>
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
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
            <Link href="/" className="text-gray-600 hover:text-blue-600 hover:underline">
              Home
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">
              Practice tests
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
            <span className="text-gray-300">|</span>
            <a
              href="mailto:info@apbluebookonline.com"
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
