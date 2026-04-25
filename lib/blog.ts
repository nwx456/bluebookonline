import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author?: string;
  tags?: string[];
  draft?: boolean;
}

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string;
}

export interface BlogPost extends BlogPostMeta {
  contentHtml: string;
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

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const file = readPostFile(slug);
  if (!file) return null;
  if (file.data.draft) return null;
  const processed = await remark().use(remarkGfm).use(remarkHtml).process(file.content);
  const contentHtml = processed.toString();
  return { slug, contentHtml, ...file.data };
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
