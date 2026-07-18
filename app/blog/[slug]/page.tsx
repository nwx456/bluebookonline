import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { BlogPostCta } from "@/components/blog/BlogPostCta";
import { BlogRelatedPosts } from "@/components/blog/BlogRelatedPosts";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import {
  buildFaqPageJsonLd,
  formatBlogDate,
  getAllPostSlugs,
  getPostBySlug,
  getPostImage,
  getPostLastModified,
  getPostMetaDescription,
  getPostSeoTitle,
  getRelatedPosts,
} from "@/lib/blog";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

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
  const title = getPostSeoTitle(post);
  const description = getPostMetaDescription(post);
  const image = getPostImage(post);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      type: "article",
      publishedTime: post.date,
      modifiedTime: getPostLastModified(post),
      authors: post.author ? [post.author] : undefined,
      images: [image.startsWith("http") ? image : `${baseUrl}${image}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
  const lastModified = getPostLastModified(post);
  const image = getPostImage(post);
  const imageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: getPostMetaDescription(post),
    datePublished: post.date,
    dateModified: lastModified,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: post.author
      ? { "@type": "Person", name: post.author }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: baseUrl,
    },
    image: imageUrl,
    keywords: post.focusKeyword ?? post.tags?.join(", "),
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

  const faqJsonLd = buildFaqPageJsonLd(post.faq, url);
  const relatedPosts = getRelatedPosts(post, 3);

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <SiteHeader />

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
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              {post.updated && post.updated !== post.date && (
                <>
                  <span className="text-gray-400">&middot;</span>
                  <span>
                    Updated <time dateTime={post.updated}>{formatBlogDate(post.updated)}</time>
                  </span>
                </>
              )}
              {post.author && (
                <>
                  <span className="text-gray-400">&middot;</span>
                  <span>{post.author}</span>
                </>
              )}
              {post.category && (
                <>
                  <span className="text-gray-400">&middot;</span>
                  <span className="font-medium text-blue-600">{post.category}</span>
                </>
              )}
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

          <BlogTableOfContents items={post.toc} />

          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          {post.faq && post.faq.length > 0 && (
            <section className="mt-10 border-t border-gray-100 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently asked questions</h2>
              <div className="space-y-4">
                {post.faq.map((item) => (
                  <div key={item.question} className="rounded-lg bg-gray-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">{item.question}</h3>
                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <BlogPostCta post={post} />
        </article>

        <BlogRelatedPosts posts={relatedPosts} />
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
            <Link href="/tools/ap-score-calculator" className="text-gray-600 hover:text-blue-600 hover:underline">
              Score calculator
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
