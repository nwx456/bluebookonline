import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Calendar, ArrowLeft } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { formatBlogDate, getAllPostMeta, getAllPostSlugs, getPostBySlug } from "@/lib/blog";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  const url = `${baseUrl}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${post.title} | Bluebook Online`,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const url = `${baseUrl}/blog/${post.slug}`;

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: "Bluebook Online" },
    publisher: {
      "@type": "Organization",
      name: "Bluebook Online",
      url: baseUrl,
    },
    image: `${baseUrl}/og-image.png`,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const otherPosts = getAllPostMeta()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All posts
        </Link>

        <article className="rounded-2xl bg-white px-6 py-10 sm:px-10 shadow-sm border border-gray-100">
          <header className="mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              {formatBlogDate(post.date)}
              {post.author && <span className="text-gray-400">&middot; {post.author}</span>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-gray-900 leading-tight">
              {post.title}
            </h1>
            <p className="mt-3 text-base text-gray-600 leading-relaxed">{post.description}</p>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </header>

          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>

        {otherPosts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">More posts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {otherPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all"
                >
                  <p className="text-xs text-gray-500">{formatBlogDate(p.date)}</p>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                </Link>
              ))}
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
            <Link href="/blog" className="text-gray-600 hover:text-blue-600 hover:underline">
              Blog
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/exams" className="text-gray-600 hover:text-blue-600 hover:underline">
              Practice tests
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/about" className="text-gray-600 hover:text-blue-600 hover:underline">
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
