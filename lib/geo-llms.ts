import { getAllPostMeta } from "@/lib/blog";
import { SCORE_CALCULATOR_EXAMS } from "@/lib/score-calculator-data";
import { ALL_SUBJECTS } from "@/lib/subject-meta";
import {
  CONTACT_EMAIL,
  getSiteUrl,
  SITE_META_DESCRIPTION,
  SITE_NAME,
} from "@/lib/site-config";

const CITATION_PRIORITY_SLUGS = [
  "ap-exam-dates-2026",
  "sat-test-dates-2026",
  "how-ap-exams-are-scored",
  "how-digital-sat-adaptive-testing-works",
  "ap-score-distributions",
  "sat-score-percentiles-2026",
  "digital-sat-complete-guide",
  "digital-sat-math-complete-guide",
  "digital-sat-reading-writing-complete-guide",
  "is-a-3-on-ap-exam-good",
  "is-1200-1300-1400-a-good-sat-score",
  "ap-score-calculator-by-subject",
  "ap-score-calculator-how-to-use",
  "digital-sat-score-calculator-how-to-use",
  "when-do-ap-scores-come-out",
  "fully-digital-vs-hybrid-ap-exams",
  "free-official-ap-study-resources",
  "free-official-digital-sat-practice-resources",
  "what-is-a-good-ap-score",
  "how-many-questions-on-digital-sat",
  "ap-exam-length-by-subject",
];

export function getAllPublicUrls(): string[] {
  const base = getSiteUrl();
  const core = [
    base,
    `${base}/sat`,
    `${base}/exams`,
    `${base}/resources`,
    `${base}/about`,
    `${base}/blog`,
    `${base}/legal`,
    `${base}/privacy`,
    `${base}/terms`,
    `${base}/cookies`,
    `${base}/copyright`,
    `${base}/tools/ap-score-calculator`,
    `${base}/tools/sat-score-calculator`,
  ];

  const subjectUrls = ALL_SUBJECTS.map((s) => `${base}/exams/${s.slug}`);
  const blogUrls = getAllPostMeta().map((p) => `${base}/blog/${p.slug}`);
  const calcUrls = SCORE_CALCULATOR_EXAMS.map(
    (e) => `${base}/tools/ap-score-calculator/${e.slug}`,
  );

  return [...core, ...subjectUrls, ...blogUrls, ...calcUrls];
}

export function buildLlmsTxt(): string {
  const base = getSiteUrl();
  const posts = getAllPostMeta();
  const postBySlug = new Map(posts.map((p) => [p.slug, p]));

  const citationUrls = CITATION_PRIORITY_SLUGS.filter((slug) => postBySlug.has(slug)).map(
    (slug) => `${base}/blog/${slug}`,
  );

  const apSubjects = ALL_SUBJECTS.filter((s) => s.category !== "sat");
  const satSubjects = ALL_SUBJECTS.filter((s) => s.category === "sat");

  const lines: string[] = [
    `# ${SITE_NAME}`,
    `> ${SITE_META_DESCRIPTION}`,
    "",
    "## About",
    `${SITE_NAME} is an independent educational platform (not affiliated with College Board).`,
    "We provide free Bluebook-style AP and Digital SAT practice tests, score calculators, and study guides.",
    "",
    "## Core pages",
    `- ${base}/ — AP practice home`,
    `- ${base}/sat — Digital SAT practice home`,
    `- ${base}/exams — All practice test subjects`,
    `- ${base}/blog — Study guides and exam prep articles`,
    `- ${base}/about — Platform overview and FAQs`,
    `- ${base}/tools/ap-score-calculator — AP score calculators (all 24 subjects)`,
    `- ${base}/tools/sat-score-calculator — Digital SAT score calculator`,
    "",
    "## Best for AI citation",
    ...citationUrls.map((url) => `- ${url}`),
    "",
    "## AP subject clusters (exam + calculator + guide)",
  ];

  for (const subject of apSubjects) {
    const guide = subject.relatedBlogSlug
      ? `${base}/blog/${subject.relatedBlogSlug}`
      : "(no guide)";
    lines.push(
      `- ${subject.fullName}: ${base}/exams/${subject.slug} | ${base}/tools/ap-score-calculator/${subject.slug} | ${guide}`,
    );
  }

  lines.push("", "## SAT subject clusters");
  for (const subject of satSubjects) {
    const guide = subject.relatedBlogSlug
      ? `${base}/blog/${subject.relatedBlogSlug}`
      : "(no guide)";
    lines.push(
      `- ${subject.fullName}: ${base}/exams/${subject.slug} | ${base}/tools/sat-score-calculator | ${guide}`,
    );
  }

  lines.push(
    "",
    "## Contact",
    `- Email: ${CONTACT_EMAIL}`,
    `- Full URL list: ${base}/llms-full.txt`,
    "",
    "## Disclaimer",
    "Not endorsed by, sponsored by, or connected with College Board, AP, SAT, or Bluebook.",
    "Score calculators and study content are estimates based on publicly available College Board materials.",
  );

  return lines.join("\n");
}

export function buildLlmsFullTxt(): string {
  const base = getSiteUrl();
  const urls = getAllPublicUrls();
  return [
    `# ${SITE_NAME} — Full public URL list`,
    `> Generated from sitemap sources. ${urls.length} URLs.`,
    "",
    ...urls.map((url) => `- ${url}`),
    "",
    `Summary index: ${base}/llms.txt`,
  ].join("\n");
}
