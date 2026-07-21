import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";
import type { ExamProgram } from "@/lib/exam-program";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export const BLOG_CATEGORIES = [
  "Scores & Curves",
  "Digital Exams",
  "Digital SAT",
  "Study Guides",
  "Course Selection",
  "Score Calculators",
] as const;

export type BlogProgram = ExamProgram;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogSource {
  name: string;
  url: string;
}

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author?: string;
  tags?: string[];
  draft?: boolean;
  focusKeyword?: string;
  seoTitle?: string;
  metaDescription?: string;
  updated?: string;
  faq?: BlogFaqItem[];
  image?: string;
  imageAlt?: string;
  category?: BlogCategory;
  /** AP (default) or SAT — controls blog hub filtering and related posts */
  program?: BlogProgram;
  /** Optional CTA overrides for post footer */
  ctaPrimaryHref?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryHref?: string;
  ctaSecondaryLabel?: string;
  sources?: BlogSource[];
  verifiedDate?: string;
}

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string;
}

export interface BlogTocItem {
  id: string;
  text: string;
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string;
  toc: BlogTocItem[];
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractTocFromMarkdown(content: string): BlogTocItem[] {
  const toc: BlogTocItem[] = [];
  const seen = new Set<string>();
  for (const line of content.split("\n")) {
    const match = /^##\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const text = match[1].replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
    let id = slugifyHeading(text);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seen.add(id);
    toc.push({ id, text });
  }
  return toc;
}

function addHeadingIds(html: string, toc: BlogTocItem[]): string {
  let index = 0;
  return html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    const item = toc[index];
    index += 1;
    if (!item) return `<h2>${inner}</h2>`;
    return `<h2 id="${item.id}">${inner}</h2>`;
  });
}

function readPostFile(slug: string): { data: BlogFrontmatter; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data as BlogFrontmatter, content: parsed.content };
}

export function getAllPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getPostProgram(post: BlogPostMeta): BlogProgram {
  return post.program ?? "AP";
}

export function getAllPostMeta(): BlogPostMeta[] {
  const slugs = getAllPostSlugs();
  const posts: BlogPostMeta[] = [];
  for (const slug of slugs) {
    const file = readPostFile(slug);
    if (!file) continue;
    if (file.data.draft) continue;
    posts.push({ slug, ...file.data });
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostsByProgram(program: BlogProgram): BlogPostMeta[] {
  return getAllPostMeta().filter((p) => getPostProgram(p) === program);
}

export function getPostLastModified(post: BlogPostMeta): string {
  return post.updated ?? post.date;
}

export function getPostSeoTitle(post: BlogPostMeta): string {
  return post.seoTitle ?? post.title;
}

export function getPostMetaDescription(post: BlogPostMeta): string {
  return post.metaDescription ?? post.description;
}

export function getPostImage(post: BlogPostMeta): string {
  return post.image ?? "/og-image.png";
}

export function getRelatedPosts(current: BlogPostMeta, limit = 3): BlogPostMeta[] {
  const program = getPostProgram(current);
  const all = getAllPostMeta().filter(
    (p) => p.slug !== current.slug && getPostProgram(p) === program,
  );
  const scored = all.map((p) => {
    let score = 0;
    if (current.category && p.category === current.category) score += 10;
    if (current.tags && p.tags) {
      for (const tag of current.tags) {
        if (p.tags.includes(tag)) score += 3;
      }
    }
    return { post: p, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.post.date.localeCompare(a.post.date);
  });
  const related = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.post);
  if (related.length >= limit) return related;
  const fallback = all.filter((p) => !related.some((r) => r.slug === p.slug)).slice(0, limit - related.length);
  return [...related, ...fallback];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const file = readPostFile(slug);
  if (!file) return null;
  if (file.data.draft) return null;
  const toc = extractTocFromMarkdown(file.content);
  const processed = await remark().use(remarkGfm).use(remarkHtml).process(file.content);
  const contentHtml = addHeadingIds(processed.toString(), toc);
  return { slug, contentHtml, toc, ...file.data };
}

export function formatBlogDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export function buildFaqPageJsonLd(faq: BlogFaqItem[] | undefined, pageUrl: string) {
  if (!faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
}
