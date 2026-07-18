import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkHtml from "remark-html";
import remarkGfm from "remark-gfm";

const LEGAL_DIR = path.join(process.cwd(), "content", "legal");

export type LegalDocumentSlug = "terms" | "privacy" | "cookies" | "copyright";

export interface LegalFrontmatter {
  title: string;
  description: string;
  lastUpdated: string;
  version: string;
}

export interface LegalHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface LegalDocumentMeta extends LegalFrontmatter {
  slug: LegalDocumentSlug;
  href: string;
  summary: string;
}

export interface LegalDocument extends LegalDocumentMeta {
  contentHtml: string;
  headings: LegalHeading[];
}

export const LEGAL_DOCUMENT_CATALOG: LegalDocumentMeta[] = [
  {
    slug: "terms",
    href: "/terms",
    title: "Terms of Service",
    description: "Rules for using AP Practice Exam Online, uploads, AI processing, and public sharing.",
    summary:
      "Account eligibility, user content, source attestation, moderation, disclaimers, and termination.",
    lastUpdated: "July 2026",
    version: "2.0",
  },
  {
    slug: "privacy",
    href: "/privacy",
    title: "Privacy Policy",
    description: "How we collect, use, store, and protect personal data worldwide.",
    summary:
      "Data categories, lawful bases, sub-processors, retention, your rights, and regional addenda (EU, TR, US, MENA).",
    lastUpdated: "July 2026",
    version: "2.0",
  },
  {
    slug: "cookies",
    href: "/cookies",
    title: "Cookie Policy",
    description: "Cookies, local storage, and advertising technologies we use.",
    summary: "Essential vs optional cookies, regional consent, and how to manage preferences.",
    lastUpdated: "July 2026",
    version: "2.0",
  },
  {
    slug: "copyright",
    href: "/copyright",
    title: "Copyright & DMCA Policy",
    description: "Copyright rules for uploads and how to report infringement.",
    summary:
      "User representations, moderation, takedown notices, repeat infringer policy, and counter-notifications.",
    lastUpdated: "July 2026",
    version: "2.0",
  },
];

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(markdown: string): LegalHeading[] {
  const headings: LegalHeading[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/\{#.+?\}$/, "").trim();
    let id = slugifyHeading(text);
    const count = seen.get(id) ?? 0;
    if (count > 0) id = `${id}-${count + 1}`;
    seen.set(slugifyHeading(text), count + 1);
    headings.push({ id, text, level });
  }
  return headings;
}

function injectHeadingIds(html: string, headings: LegalHeading[]): string {
  let index = 0;
  return html.replace(/<(h[23])>([^<]+)<\/\1>/g, (_match, tag: string, inner: string) => {
    const heading = headings[index];
    index += 1;
    const id = heading?.id ?? slugifyHeading(inner);
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
}

function readLegalFile(slug: LegalDocumentSlug): { data: LegalFrontmatter; content: string } | null {
  const filePath = path.join(LEGAL_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data as LegalFrontmatter, content: parsed.content };
}

export function getLegalCatalogItem(slug: LegalDocumentSlug): LegalDocumentMeta {
  const item = LEGAL_DOCUMENT_CATALOG.find((d) => d.slug === slug);
  if (!item) throw new Error(`Unknown legal document: ${slug}`);
  return item;
}

export async function getLegalDocument(slug: LegalDocumentSlug): Promise<LegalDocument | null> {
  const file = readLegalFile(slug);
  if (!file) return null;
  const catalog = getLegalCatalogItem(slug);
  const headings = extractHeadings(file.content);
  const processed = await remark().use(remarkGfm).use(remarkHtml).process(file.content);
  const contentHtml = injectHeadingIds(processed.toString(), headings);
  return {
    ...catalog,
    ...file.data,
    contentHtml,
    headings,
  };
}

export function getAllLegalSlugs(): LegalDocumentSlug[] {
  return LEGAL_DOCUMENT_CATALOG.map((d) => d.slug);
}
