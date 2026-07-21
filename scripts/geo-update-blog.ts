/**
 * One-off GEO content batch updater for blog frontmatter and short-answer blocks.
 * Run: npx tsx scripts/geo-update-blog.ts
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SUBJECT_BY_SLUG } from "../lib/subject-meta";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

const FAQ_FIX_SLUGS = [
  "ap-biology-complete-guide",
  "ap-chemistry-complete-guide",
  "ap-calculus-ab-complete-guide",
  "ap-us-history-complete-guide",
  "ap-world-history-complete-guide",
  "ap-english-language-complete-guide",
  "ap-psychology-complete-guide",
  "ap-statistics-complete-guide",
];

const MISSING_UPDATED = [
  "ap-credit-policy-explained.md",
  "ap-csa-vs-csp.md",
  "ap-environmental-science-frq-guide.md",
  "ap-european-history-dbq-guide.md",
  "ap-exam-dates-2026.md",
  "ap-lang-vs-ap-lit.md",
  "ap-micro-vs-macro.md",
  "ap-physics-1-vs-2-vs-c.md",
  "ap-score-calculator-by-subject.md",
  "ap-score-calculator-how-to-use.md",
  "ap-us-government-scotus-cases.md",
  "easiest-ap-exams-to-self-study.md",
  "how-many-ap-classes.md",
  "how-to-get-a-5-on-ap-exams.md",
  "is-a-3-on-ap-exam-good.md",
  "using-ai-for-ap-prep-pros-cons.md",
  "which-ap-classes-to-take.md",
];

const AP_CED_SOURCES: Record<string, string> = {
  "ap-biology": "https://apcentral.collegeboard.org/courses/ap-biology",
  "ap-chemistry": "https://apcentral.collegeboard.org/courses/ap-chemistry",
  "ap-calculus-ab": "https://apcentral.collegeboard.org/courses/ap-calculus-ab",
  "ap-calculus-bc": "https://apcentral.collegeboard.org/courses/ap-calculus-bc",
  "ap-us-history": "https://apcentral.collegeboard.org/courses/ap-united-states-history",
  "ap-world-history": "https://apcentral.collegeboard.org/courses/ap-world-history-modern",
  "ap-english-language": "https://apcentral.collegeboard.org/courses/ap-english-language-and-composition",
  "ap-psychology": "https://apcentral.collegeboard.org/courses/ap-psychology",
  "ap-statistics": "https://apcentral.collegeboard.org/courses/ap-statistics",
};

function examSlugFromGuideSlug(slug: string): string | null {
  const m = /^ap-(.+)-complete-guide$/.exec(slug);
  return m ? `ap-${m[1]}` : null;
}

function buildShortAnswer(examSlug: string): string | null {
  const meta = SUBJECT_BY_SLUG[examSlug];
  if (!meta) return null;
  const date = meta.examDate2026 ?? "May 2026";
  const duration = meta.examFormat.totalDurationMin ?? meta.examFormat.durationMin;
  const mode =
    meta.examFormat.examMode === "fully-digital"
      ? "fully digital in Bluebook"
      : meta.examFormat.examMode === "hybrid-digital"
        ? "hybrid digital (MCQ in Bluebook, paper FRQs)"
        : "Bluebook digital";
  return `**Short answer:** The 2026 ${meta.fullName} exam is ${date} — ${meta.examFormat.mcqCount} MCQs, ${duration} minutes total, ${mode}.`;
}

function satShortAnswer(slug: string): string | null {
  if (slug === "digital-sat-complete-guide") {
    return "**Short answer:** The Digital SAT is ~2 hours 14 minutes — 54 Reading & Writing questions (64 min) plus 44 Math questions (70 min), adaptive Module 2, scored 400–1600.";
  }
  if (slug === "digital-sat-math-complete-guide") {
    return "**Short answer:** Digital SAT Math is 70 minutes — two adaptive modules of 22 questions each, Desmos calculator allowed throughout, ~25% grid-in.";
  }
  if (slug === "digital-sat-reading-writing-complete-guide") {
    return "**Short answer:** Digital SAT Reading & Writing is 64 minutes — two adaptive modules of 27 questions each, no calculator, scored 200–800.";
  }
  return null;
}

function stripTrailingSourcesBlock(content: string): string {
  return content.replace(
    /\n---\n\*Sources:[\s\S]*?\*Verified[^\n]*\.\s*$/m,
    "",
  );
}

for (const file of fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"))) {
  const filePath = path.join(BLOG_DIR, file);
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  let data = { ...parsed.data } as Record<string, unknown>;
  let content = parsed.content;
  let changed = false;

  if (FAQ_FIX_SLUGS.includes(slug)) {
    const examSlug = examSlugFromGuideSlug(slug);
    if (examSlug && SUBJECT_BY_SLUG[examSlug]) {
      const faqs = SUBJECT_BY_SLUG[examSlug].faqs.map((f) => ({
        question: f.q,
        answer: f.a,
      }));
      data.faq = faqs;
      changed = true;
    }
  }

  if (slug === "using-ai-for-ap-prep-pros-cons") {
    data.focusKeyword = "using ai for ap exam prep";
    data.updated = "2026-07-21";
    data.category = "Study Guides";
    data.faq = [
      {
        question: "Is using AI for AP prep cheating?",
        answer:
          "Using AI to explain mistakes or generate extra practice is not cheating. Submitting AI-written FRQ answers as your own work is. Treat AI as a tutor, not a ghostwriter.",
      },
      {
        question: "Does AI scoring replace official AP answer keys?",
        answer:
          "No. AI-generated keys are estimates for practice. Always verify high-stakes answers against teacher feedback or official College Board materials when available.",
      },
      {
        question: "What is the biggest risk of AI for AP students?",
        answer:
          "Passive consumption — reading AI explanations without attempting problems first weakens the reasoning skills AP exams test.",
      },
      {
        question: "Where does AI help most for AP prep?",
        answer:
          "Instant answer keys for PDF practice tests, targeted drill generation, and step-by-step explanations for specific missed questions.",
      },
      {
        question: "Can teachers use AI-generated practice exams?",
        answer:
          "Yes, when they review content for accuracy. Platforms like AP Practice Exam Online let teachers upload PDFs and share Bluebook-style digital practice with classes.",
      },
    ];
    data.sources = [
      {
        name: "College Board AP Central",
        url: "https://apcentral.collegeboard.org/",
      },
    ];
    data.verifiedDate = "July 2026";
    changed = true;
  }

  if (MISSING_UPDATED.includes(file) && !data.updated) {
    data.updated = "2026-07-21";
    changed = true;
  }

  const examSlug = examSlugFromGuideSlug(slug);
  if (examSlug && AP_CED_SOURCES[examSlug]) {
    if (!data.sources) {
      data.sources = [
        {
          name: `College Board ${SUBJECT_BY_SLUG[examSlug]?.fullName ?? "AP"} CED`,
          url: AP_CED_SOURCES[examSlug],
        },
      ];
      changed = true;
    }
    if (!data.verifiedDate) {
      data.verifiedDate = "July 2026";
      changed = true;
    }
  }

  if (slug.startsWith("digital-sat-") && slug.endsWith("-complete-guide")) {
    if (!data.sources) {
      data.sources = [
        {
          name: "College Board Digital SAT",
          url: "https://satsuite.collegeboard.org/digital",
        },
      ];
      changed = true;
    }
    if (!data.verifiedDate) {
      data.verifiedDate = "July 2026";
      changed = true;
    }
  }

  const shortAnswer = examSlug
    ? buildShortAnswer(examSlug)
    : satShortAnswer(slug);
  if (shortAnswer && !content.includes("**Short answer:**")) {
    content = stripTrailingSourcesBlock(content);
    content = `${shortAnswer}\n\n${content.trimStart()}`;
    changed = true;
  }

  if (changed) {
    const out = matter.stringify(content, data);
    fs.writeFileSync(filePath, out, "utf8");
    console.log("updated", file);
  }
}

console.log("done");
