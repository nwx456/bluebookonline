import {
  SAT_MODULES,
  type SatAdaptiveMode,
  type SatModuleId,
  type SatModuleVariant,
  type SatSection,
} from "@/lib/exam-program";
import {
  applyBucketToQuestion,
  bucketKey,
  inferModuleNumberFromLabel,
  inferVariantFromLabel,
} from "@/lib/sat-module-normalizer";
import type { SatModuleBucket } from "@/lib/sat-module-normalizer";

export interface SatModuleReport {
  rw1: number;
  rw2: number;
  rw2Easy: number;
  rw2Hard: number;
  math1: number;
  math2: number;
  math2Easy: number;
  math2Hard: number;
}

export interface SatValidationResult {
  ok: boolean;
  error?: string;
  emptyBucketKeys?: string[];
  overfullBucketKeys?: string[];
  warnings?: string[];
}

export interface SatValidationOptions {
  userModuleCounts?: Record<string, number>;
}

/** Kept only for downstream typing compatibility; discovery phase removed. */
export type SatStructureDetected = null;

function defaultExpectedCount(section: SatSection, module: 1 | 2): number {
  const mod = SAT_MODULES.find((m) => m.section === section && m.module === module);
  return mod?.questionCount ?? (section === "rw" ? 27 : 22);
}

function rwBucketsSix(): SatModuleBucket[] {
  return [
    { section: "rw", module: 1, variant: null, pdfLabels: [] },
    { section: "rw", module: 2, variant: "easy", pdfLabels: [] },
    { section: "rw", module: 2, variant: "hard", pdfLabels: [] },
  ];
}

function mathBucketsSix(): SatModuleBucket[] {
  return [
    { section: "math", module: 1, variant: null, pdfLabels: [] },
    { section: "math", module: 2, variant: "easy", pdfLabels: [] },
    { section: "math", module: 2, variant: "hard", pdfLabels: [] },
  ];
}

function fourModuleBuckets(): SatModuleBucket[] {
  return [
    { section: "rw", module: 1, variant: null, pdfLabels: [] },
    { section: "rw", module: 2, variant: null, pdfLabels: [] },
    { section: "math", module: 1, variant: null, pdfLabels: [] },
    { section: "math", module: 2, variant: null, pdfLabels: [] },
  ];
}

/** Retry a bucket extraction only when the model returned zero questions. */
export function bucketExtractionNeedsRetry(count: number): boolean {
  return count === 0;
}

/** Gap below expected count that triggers one supplemental bucket Gemini call. */
export const BUCKET_SUPPLEMENT_GAP = 5;

/** True when a six_module bucket needs a targeted retry (empty or far below target). */
export function bucketNeedsSupplementalExtract(
  actual: number,
  expected: number
): boolean {
  if (expected <= 0) return false;
  if (actual === 0) return true;
  return actual < expected - BUCKET_SUPPLEMENT_GAP;
}

/**
 * Build the extraction plan for a SAT upload.
 *
 * The user-entered module counts (if present) are the source of truth for
 * expectedCount; otherwise we fall back to the official SAT default counts.
 * Structure discovery has been removed — module tagging is done post-hoc via
 * bucket-force tagging plus the multi-lingual label matcher.
 */
export function buildSatExtractionPlan(
  adaptiveMode: SatAdaptiveMode,
  sectionFilter?: SatSection | null,
  userModuleCounts?: Record<string, number> | null
): SatModuleBucket[] {
  const base =
    adaptiveMode === "six_module"
      ? [...rwBucketsSix(), ...mathBucketsSix()]
      : fourModuleBuckets();

  const filtered = sectionFilter
    ? base.filter((b) => b.section === sectionFilter)
    : base;

  return filtered.map((bucket) => {
    const key = bucketKeyForBucket(bucket);
    const userCount = userModuleCounts?.[key];
    return {
      ...bucket,
      detectedTitle: null,
      expectedCount:
        userCount != null && userCount > 0
          ? userCount
          : defaultExpectedCount(bucket.section, bucket.module),
    };
  });
}

function bucketKeyForBucket(bucket: SatModuleBucket): string {
  const suffix =
    bucket.module === 2 && bucket.variant
      ? bucket.variant
      : "";
  return `${bucket.section}${bucket.module}${suffix}`;
}

type AuditQuestion = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
  content?: string | null;
  question?: string | null;
  sat_pdf_module_label?: string | null;
};

/** Post-salvage warnings for module tagging issues (does not drop questions). */
export function auditSatModuleBoundaries(
  questions: AuditQuestion[],
  adaptiveMode: SatAdaptiveMode
): string[] {
  const warnings: string[] = [];
  if (adaptiveMode === "six_module") {
    let m2MissingVariant = 0;
    for (const q of questions) {
      const mod = normModule(q.sat_module);
      if (mod === 2 && !normVariant(q.sat_module_variant)) {
        m2MissingVariant++;
      }
    }
    if (m2MissingVariant > 0) {
      warnings.push(
        `${m2MissingVariant} M2 soruda sat_module_variant eksik (six_module için easy/hard gerekli)`
      );
    }
  }
  return warnings;
}

type QuestionLike = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
};

function normSection(v: unknown): SatSection | null {
  if (typeof v !== "string") return null;
  const x = v.toLowerCase().trim();
  return x === "rw" || x === "math" ? x : null;
}

function normModule(v: unknown): 1 | 2 | null {
  if (v === 1 || v === 2) return v;
  const n = Number(v);
  return n === 1 || n === 2 ? (n as 1 | 2) : null;
}

function normVariant(v: unknown): "easy" | "hard" | null {
  if (typeof v !== "string") return null;
  const x = v.toLowerCase().trim();
  return x === "easy" || x === "hard" ? x : null;
}

export function buildSatModuleReport(questions: QuestionLike[]): SatModuleReport {
  const report: SatModuleReport = {
    rw1: 0,
    rw2: 0,
    rw2Easy: 0,
    rw2Hard: 0,
    math1: 0,
    math2: 0,
    math2Easy: 0,
    math2Hard: 0,
  };

  for (const q of questions) {
    const section = normSection(q.sat_section);
    const modNum = normModule(q.sat_module);
    if (!section || !modNum) continue;
    const variant = normVariant(q.sat_module_variant);

    if (section === "rw" && modNum === 1) report.rw1++;
    if (section === "rw" && modNum === 2) {
      report.rw2++;
      if (variant === "easy") report.rw2Easy++;
      if (variant === "hard") report.rw2Hard++;
    }
    if (section === "math" && modNum === 1) report.math1++;
    if (section === "math" && modNum === 2) {
      report.math2++;
      if (variant === "easy") report.math2Easy++;
      if (variant === "hard") report.math2Hard++;
    }
  }

  return report;
}

export function reportToLegacyModuleCounts(
  report: SatModuleReport
): Record<SatModuleId, number> {
  return {
    rw1: report.rw1,
    rw2: report.rw2Easy + report.rw2Hard || report.rw2,
    math1: report.math1,
    math2: report.math2Easy + report.math2Hard || report.math2,
  };
}

export function reportCountForBucketKey(report: SatModuleReport, key: string): number {
  switch (key) {
    case "rw1":
      return report.rw1;
    case "rw2":
      return report.rw2;
    case "rw2easy":
      return report.rw2Easy;
    case "rw2hard":
      return report.rw2Hard;
    case "math1":
      return report.math1;
    case "math2":
      return report.math2;
    case "math2easy":
      return report.math2Easy;
    case "math2hard":
      return report.math2Hard;
    default:
      return 0;
  }
}

const BUCKET_WARNING_LABELS: Record<string, string> = {
  rw1: "R&W M1",
  rw2: "R&W M2",
  rw2easy: "R&W M2 Easy",
  rw2hard: "R&W M2 Hard",
  math1: "Math M1",
  math2: "Math M2",
  math2easy: "Math M2 Easy",
  math2hard: "Math M2 Hard",
};

export function formatModuleCountWarnings(
  report: SatModuleReport,
  userModuleCounts: Record<string, number>
): string[] {
  const warnings: string[] = [];
  for (const [key, expected] of Object.entries(userModuleCounts)) {
    const actual = reportCountForBucketKey(report, key);
    if (actual < expected) {
      warnings.push(`${key}: ${actual}/${expected}`);
    }
  }
  return warnings;
}

/** Turkish summary for UI when extracted counts fall below user-entered targets. */
export function formatTurkishModuleCountWarning(
  report: SatModuleReport,
  userModuleCounts: Record<string, number>
): string | undefined {
  const parts: string[] = [];
  for (const [key, expected] of Object.entries(userModuleCounts)) {
    const actual = reportCountForBucketKey(report, key);
    if (actual < expected) {
      const label = BUCKET_WARNING_LABELS[key] ?? key;
      parts.push(`${label}: ${actual}/${expected} bekleniyordu`);
    }
  }
  if (parts.length === 0) return undefined;
  return `Bazı modüllerde hedef sayıya ulaşılamadı: ${parts.join("; ")}`;
}

export function formatSatModuleReport(report: SatModuleReport): string {
  const parts = [
    `R&W M1: ${report.rw1}`,
    report.rw2Easy || report.rw2Hard
      ? `R&W M2-Easy: ${report.rw2Easy} | R&W M2-Hard: ${report.rw2Hard}`
      : `R&W M2: ${report.rw2}`,
    `Math M1: ${report.math1}`,
    report.math2Easy || report.math2Hard
      ? `Math M2-Easy: ${report.math2Easy} | Math M2-Hard: ${report.math2Hard}`
      : `Math M2: ${report.math2}`,
  ];
  return parts.join(" | ");
}

/**
 * Validate the extracted module report against the user-provided plan.
 *
 * Rules (simplified):
 * - When userModuleCounts are provided, they are the source of truth: an
 *   actual count greater than expected * 2 fails; below expected produces a
 *   warning; expected+5 tolerance for over-extraction.
 * - When no user counts are provided, each expected bucket must have at
 *   least one question (empty bucket = fail). No hard min sizes so that
 *   short/partial practice PDFs don't get rejected.
 */
export function validateSatModuleReport(
  report: SatModuleReport,
  adaptiveMode: SatAdaptiveMode,
  _structure?: unknown,
  sectionFilter?: SatSection | null,
  options?: SatValidationOptions
): SatValidationResult {
  if (options?.userModuleCounts) {
    return validateUserModuleCounts(report, options.userModuleCounts);
  }

  const checkRw = !sectionFilter || sectionFilter === "rw";
  const checkMath = !sectionFilter || sectionFilter === "math";
  const emptyBucketKeys: string[] = [];

  if (adaptiveMode === "six_module") {
    if (checkRw && report.rw1 === 0) emptyBucketKeys.push("rw1");
    if (checkRw && report.rw2Easy === 0) emptyBucketKeys.push("rw2Easy");
    if (checkRw && report.rw2Hard === 0) emptyBucketKeys.push("rw2Hard");
    if (checkMath && report.math1 === 0) emptyBucketKeys.push("math1");
    if (checkMath && report.math2Easy === 0) emptyBucketKeys.push("math2Easy");
    if (checkMath && report.math2Hard === 0) emptyBucketKeys.push("math2Hard");
  } else {
    if (checkRw && report.rw1 === 0) emptyBucketKeys.push("rw1");
    if (checkRw && report.rw2 === 0) emptyBucketKeys.push("rw2");
    if (checkMath && report.math1 === 0) emptyBucketKeys.push("math1");
    if (checkMath && report.math2 === 0) emptyBucketKeys.push("math2");
  }

  if (emptyBucketKeys.length === 0) return { ok: true };

  const scope = sectionFilter
    ? sectionFilter === "rw"
      ? "Reading & Writing"
      : "Math"
    : "SAT";

  const sixHint =
    adaptiveMode === "none" &&
    checkMath &&
    report.rw2 === 0 &&
    report.math2 > 0
      ? " Six-module adaptive PDF olabilir; adaptive modu seçmeyi deneyin."
      : adaptiveMode === "six_module" && report.rw2Easy + report.rw2Hard === 0
        ? " PDF 6 modül (Module A/B) içermiyor olabilir — 'Non-adaptive' seçin."
        : "";

  return {
    ok: false,
    emptyBucketKeys,
    error: `PDF'ten ${scope} modülleri çıkarılamadı. Boş modüller: ${emptyBucketKeys.join(", ")}.${sixHint} PDF'i tekrar yükleyin veya modül formatını kontrol edin.`,
  };
}

function validateUserModuleCounts(
  report: SatModuleReport,
  userModuleCounts: Record<string, number>
): SatValidationResult {
  const warnings = formatModuleCountWarnings(report, userModuleCounts);
  const overfullBucketKeys: string[] = [];
  const emptyBucketKeys: string[] = [];

  for (const [key, expected] of Object.entries(userModuleCounts)) {
    const actual = reportCountForBucketKey(report, key);
    if (expected > 0 && actual === 0) {
      emptyBucketKeys.push(key);
    }
    if (
      expected > 0 &&
      (actual > expected + BUCKET_SUPPLEMENT_GAP || actual > expected * 2)
    ) {
      overfullBucketKeys.push(key);
    }
  }

  if (emptyBucketKeys.length > 0) {
    return {
      ok: false,
      emptyBucketKeys,
      error: `Hedeflenen modüllerin bazılarından soru çıkarılamadı. Boş modüller: ${emptyBucketKeys
        .map((k) => BUCKET_WARNING_LABELS[k] ?? k)
        .join(", ")}. PDF'i tekrar yükleyin.`,
    };
  }

  if (overfullBucketKeys.length > 0) {
    return {
      ok: false,
      overfullBucketKeys,
      error: `Modül dağılımı beklenenden çok fazla soru içeriyor. Fazla: ${overfullBucketKeys
        .map((k) => BUCKET_WARNING_LABELS[k] ?? k)
        .join(", ")}. PDF'i tekrar yükleyin.`,
    };
  }

  return { ok: true, warnings };
}

const MCQ_VS_MODULE_RULE =
  "CRITICAL: Multiple-choice answer options A, B, C, D are NOT module identifiers. Only section/module HEADINGS identify modules.";

/**
 * Section-level extraction prompt. One Gemini call handles all questions in a
 * single SAT section (R&W or Math). Gemini tags every question with
 * sat_module + sat_pdf_module_label; a local splitter reorganizes them into
 * bucket groups afterwards.
 */
export function buildSatSectionExtractionPrompt(
  section: SatSection,
  opts: {
    adaptiveMode: SatAdaptiveMode;
    expectedCounts?: {
      m1?: number;
      m2?: number;
      m2Easy?: number;
      m2Hard?: number;
    };
    retry?: boolean;
  }
): string {
  const sectionLabel =
    section === "rw" ? "Reading & Writing (English)" : "Math";
  const otherSection =
    section === "rw" ? "Math (any Math module)" : "Reading & Writing";

  const mathExtraFields =
    section === "math"
      ? `, "has_graph" (boolean), "page_number" (1-based, only when has_graph is true), "bbox" (0-1 normalized {x,y,width,height}, only when has_graph is true)`
      : "";

  const counts = opts.expectedCounts ?? {};
  const totalExpected =
    opts.adaptiveMode === "six_module"
      ? (counts.m1 ?? 0) + (counts.m2Easy ?? 0) + (counts.m2Hard ?? 0)
      : (counts.m1 ?? 0) + (counts.m2 ?? 0);

  const countLine =
    totalExpected > 0
      ? `Expected total for this section: ~${totalExpected} questions. Do not stop early; extract every ${sectionLabel} question in the PDF.`
      : `Extract every ${sectionLabel} question in the PDF (a typical Digital SAT has 27 R&W or 22 Math per module).`;

  const perBucketCountLine =
    opts.adaptiveMode === "six_module" && totalExpected > 0
      ? `Required per block in this section: Module 1 ~${counts.m1 ?? "?"} | M2 Easy ~${counts.m2Easy ?? "?"} | M2 Hard ~${counts.m2Hard ?? "?"}. Extract ALL three blocks; do not stop after Module 1.`
      : "";

  const perModuleHint =
    opts.adaptiveMode === "six_module"
      ? `In six-module adaptive PDFs this section has THREE blocks:
- Module 1 (sat_module=1, sat_module_variant=null) — always present
- Module 2 Easy path — sat_module=2, sat_module_variant="easy" (aka Module A / Below the bar / Route A / Easy)
- Module 2 Hard path — sat_module=2, sat_module_variant="hard" (aka Module B / Above the bar / Route B / Hard)
Both easy AND hard second-stage blocks appear in the PDF for practice tests; include ALL of them.
CRITICAL tagging rules for six-module PDFs:
- Every Module B / hard-path question MUST set sat_module_variant="hard" (never null).
- Every Module A / easy-path question MUST set sat_module_variant="easy".
- Every question MUST set sat_pdf_module_label to the exact PDF heading you see (e.g. "Module 1", "Module A", "Module B", "Section 2 Module B: Reading and Writing"); use "unknown" only if no heading is visible.`
      : `This section has TWO blocks: Module 1 (sat_module=1) and Module 2 (sat_module=2). sat_module_variant is null.`;

  const retryHint = opts.retry
    ? `RETRY (previous attempt returned zero questions): scan the PDF from page 1 again; look for section headings in any language ("Reading and Writing", "Math", "Módulo", "Modul", "Modül", "模块", "وحدة"); include every visible MCQ + grid-in from this section.`
    : "";

  const practicePdfHint =
    opts.adaptiveMode === "six_module"
      ? ""
      : section === "rw"
        ? `PRACTICE PDF (no module headings): If the PDF is a single continuous R&W practice sheet without "Module 1/2" headers, extract ALL multiple-choice questions in order and set sat_module=1, sat_module_variant=null for every question. Never return an empty array when MCQs are visible.`
        : `PRACTICE PDF (no module headings): If there are no module headers, extract all Math questions in order; default sat_module=1 when headings are absent.`;

  const practiceBlock = practicePdfHint ? `${practicePdfHint}\n\n` : "";

  return `${MCQ_VS_MODULE_RULE}

Analyze the attached Digital SAT PDF and extract EVERY question in the ${sectionLabel} section.
- IGNORE ${otherSection} questions entirely; they will be extracted in a separate call.
- Do NOT skip questions. If a module heading is unclear, use the NEAREST PRECEDING heading you saw. If you never saw a heading, use sat_module=1.
- Preserve PDF order; questions must appear top-to-bottom the way they do in the PDF.
- ${countLine}
${perBucketCountLine ? `- ${perBucketCountLine}\n` : ""}
${perModuleHint}
${practiceBlock}
Every returned object MUST include:
  "sat_section": "${section}"       (constant for this call)
  "sat_module": 1 | 2               (never null; use nearest preceding heading if unsure)
  "sat_module_variant": "easy" | "hard" | null   (null for Module 1 or non-adaptive M2)
  "sat_pdf_module_label": string    (exact PDF heading text you saw, e.g. "Section 1, Module 1: Reading and Writing", "Module A — Easy"; use "unknown" if none seen)
  "sat_difficulty": null

${retryHint}

If text is unreadable, transcribe from the PDF; never return empty option strings when A-D choices are visible in the PDF.

Return ONLY a JSON array. Each object: "type", "content", "image_description", "options" (4 full-text strings for MCQ, [] for grid-in), "correct", "question_type", "accepted_answers", "sat_section", "sat_module", "sat_module_variant", "sat_pdf_module_label"${mathExtraFields}. NO option E. NO markdown, NO commentary. Never return [] if questions are visible in the PDF.`;
}

/**
 * Narrow module-level extraction prompt (fallback when section call returns 0).
 * Targets a single module bucket within one SAT section.
 */
export function buildSatModuleExtractionPrompt(
  bucket: SatModuleBucket,
  opts: {
    adaptiveMode: SatAdaptiveMode;
    retry?: boolean;
    isFullTestPdf?: boolean;
  }
): string {
  const sectionLabel = bucket.section === "rw" ? "Reading & Writing" : "Math";
  const otherSection =
    bucket.section === "rw" ? "Math" : "Reading & Writing";

  let bucketDesc: string;
  if (bucket.module === 1) {
    bucketDesc = `${sectionLabel} FIRST module only (Module 1 / Part 1 — NOT Module 2, NOT Module A/B)`;
  } else if (bucket.variant === "easy") {
    bucketDesc = `${sectionLabel} SECOND-STAGE EASY path ONLY (Module A / Easy / Below the bar — NOT Module 1, NOT Hard)`;
  } else if (bucket.variant === "hard") {
    bucketDesc = `${sectionLabel} SECOND-STAGE HARD path ONLY (Module B / Hard / Above the bar — NOT Module 1, NOT Easy)`;
  } else {
    bucketDesc = `${sectionLabel} SECOND module only (Module 2 / Part 2 — single M2, not adaptive split)`;
  }

  const expected =
    bucket.expectedCount ?? defaultExpectedCount(bucket.section, bucket.module);

  const mathExtraFields =
    bucket.section === "math"
      ? `, "has_graph" (boolean), "page_number" (1-based, only when has_graph is true), "bbox" (0-1 normalized {x,y,width,height}, only when has_graph is true)`
      : "";

  const variantField =
    bucket.variant != null
      ? `"sat_module_variant": "${bucket.variant}"`
      : `"sat_module_variant": null`;

  const retryHint = opts.retry
    ? "RETRY: previous attempt returned zero questions for this module. Scan module headings more carefully."
    : "";

  const noHeadingHint =
    bucket.module === 1
      ? "If this PDF has no module headings (single practice sheet), extract all questions in this section and tag them as this module."
      : "";

  const fullTestHint = opts.isFullTestPdf
    ? `This PDF is a FULL TEST containing BOTH Reading & Writing AND Math.
Extract ONLY ${sectionLabel} questions for this specific module bucket.
Do NOT re-extract questions already belonging to other modules or the ${otherSection} section.

`
    : "";

  return `${MCQ_VS_MODULE_RULE}

${fullTestHint}Analyze the attached Digital SAT PDF and extract ONLY questions in this module bucket:
${bucketDesc}

Extract approximately ${expected} questions for this module (target ${expected}; do not exceed ${expected + 2}).
STOP when the next module heading appears. IGNORE questions from other modules or the other section.

Every object MUST set:
  "sat_section": "${bucket.section}"
  "sat_module": ${bucket.module}
  ${variantField}
  "sat_pdf_module_label": exact PDF heading text (or "unknown")
  "sat_difficulty": null

${retryHint}
${noHeadingHint}

Return ONLY a JSON array. Each object: "type", "content", "image_description", "options" (4 strings for MCQ, [] for grid-in), "correct", "question_type", "accepted_answers", "sat_section", "sat_module", "sat_module_variant", "sat_pdf_module_label"${mathExtraFields}. NO option E. Never return [] when questions are visible.`;
}

// ---------------------------------------------------------------------------
// Local bucket splitter (post-Gemini)
// ---------------------------------------------------------------------------

type SplitInputQuestion = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
  sat_pdf_module_label?: string | null;
  pdf_module_label?: string | null;
  [key: string]: unknown;
};

function normalizeModuleValue(v: unknown): 1 | 2 | null {
  if (v === 1 || v === 2) return v;
  const n = Number(v);
  return n === 1 || n === 2 ? (n as 1 | 2) : null;
}

function normalizeVariantValue(v: unknown): SatModuleVariant | null {
  if (typeof v !== "string") return null;
  const x = v.toLowerCase().trim();
  return x === "easy" || x === "hard" ? x : null;
}

function pickLabel(q: SplitInputQuestion): string {
  const raw =
    (typeof q.sat_pdf_module_label === "string" && q.sat_pdf_module_label) ||
    (typeof q.pdf_module_label === "string" && q.pdf_module_label) ||
    "";
  return raw.trim();
}

/** Scan PDF label field plus short content/passage prefixes for module headings. */
function pickLabelFromQuestion(q: SplitInputQuestion): string {
  const direct = pickLabel(q);
  if (direct) return direct;
  const content = typeof q.content === "string" ? q.content : "";
  const passage =
    typeof q.image_description === "string" ? q.image_description : "";
  return `${content.slice(0, 200)} ${passage.slice(0, 200)}`.trim();
}

export interface SplitBucketOptions {
  userModuleCounts?: Record<string, number> | null;
}

function easyCountForSection(
  section: SatSection,
  userModuleCounts?: Record<string, number> | null
): number | null {
  if (!userModuleCounts) return null;
  const key = section === "rw" ? "rw2easy" : "math2easy";
  const n = userModuleCounts[key];
  return typeof n === "number" && n > 0 ? n : null;
}

function hardCountForSection(
  section: SatSection,
  userModuleCounts?: Record<string, number> | null
): number | null {
  if (!userModuleCounts) return null;
  const key = section === "rw" ? "rw2hard" : "math2hard";
  const n = userModuleCounts[key];
  return typeof n === "number" && n > 0 ? n : null;
}

/** How many of `total` M2 rows go to easy when splitting by user target ratio. */
function proportionalEasyShare(
  total: number,
  easyLimit: number,
  hardLimit: number
): number {
  if (total <= 0) return 0;
  const sum = easyLimit + hardLimit;
  if (sum <= 0) return total;

  let easyShare = Math.round((total * easyLimit) / sum);
  easyShare = Math.max(0, Math.min(easyShare, total));

  if (total >= 2 && hardLimit > 0) {
    easyShare = Math.min(easyShare, total - 1);
  }

  return easyShare;
}

type TaggedQuestion<T> = {
  q: T;
  modNum: 1 | 2;
  variant: SatModuleVariant | null;
};

function assignSixModuleVariants<T extends SplitInputQuestion>(
  tagged: TaggedQuestion<T>[],
  section: SatSection,
  userModuleCounts?: Record<string, number> | null
): void {
  const easyLimit = easyCountForSection(section, userModuleCounts);
  const hardLimit = hardCountForSection(section, userModuleCounts);
  let runVariant: SatModuleVariant | null = null;

  for (const item of tagged) {
    if (item.modNum === 1) {
      runVariant = null;
      continue;
    }
    if (item.variant != null) {
      runVariant = item.variant;
      continue;
    }

    const textVariant = inferVariantFromLabel(pickLabelFromQuestion(item.q));
    if (textVariant) {
      item.variant = textVariant;
      runVariant = textVariant;
    }
  }

  const nullM2 = tagged.filter((item) => item.modNum === 2 && item.variant == null);
  if (nullM2.length > 0 && easyLimit != null && hardLimit != null) {
    const easyShare = proportionalEasyShare(nullM2.length, easyLimit, hardLimit);
    for (let i = 0; i < nullM2.length; i++) {
      nullM2[i].variant = i < easyShare ? "easy" : "hard";
    }
    return;
  }

  if (nullM2.length > 0 && easyLimit != null) {
    for (let i = 0; i < nullM2.length; i++) {
      nullM2[i].variant = i < easyLimit ? "easy" : "hard";
    }
    return;
  }

  for (const item of nullM2) {
    item.variant = runVariant ?? "easy";
  }
}

/**
 * When Gemini tags every M2 row as easy (or proportional split left hard empty),
 * move a slice from the easy bucket to hard using the user target ratio.
 */
export function rebalanceSixModuleM2Buckets<T extends SplitInputQuestion>(
  buckets: Array<{ bucket: SatModuleBucket; questions: T[] }>,
  section: SatSection,
  userModuleCounts?: Record<string, number> | null
): number {
  const easyLimit = easyCountForSection(section, userModuleCounts);
  const hardLimit = hardCountForSection(section, userModuleCounts);
  if (!hardLimit || hardLimit <= 0) return 0;

  const easyBucket = buckets.find(
    (b) => b.bucket.module === 2 && b.bucket.variant === "easy"
  );
  const hardBucket = buckets.find(
    (b) => b.bucket.module === 2 && b.bucket.variant === "hard"
  );
  if (!easyBucket || !hardBucket || hardBucket.questions.length > 0) return 0;
  if (easyBucket.questions.length < 2) return 0;

  const total = easyBucket.questions.length;
  const easyShare = proportionalEasyShare(
    total,
    easyLimit ?? total,
    hardLimit
  );
  const toMove = total - easyShare;
  if (toMove <= 0) return 0;

  const moving = easyBucket.questions.splice(easyShare, toMove);
  for (const q of moving) {
    hardBucket.questions.push(
      applyBucketToQuestion(q as unknown as object, hardBucket.bucket) as unknown as T
    );
  }

  return toMove;
}

export interface SplitBucketResult<T extends SplitInputQuestion> {
  buckets: Array<{ bucket: SatModuleBucket; questions: T[] }>;
  m2RebalanceMoved: number;
}

/**
 * Assign each question in a section to a concrete SatModuleBucket. Priority:
 *   1) Gemini's sat_module + sat_module_variant tag (if valid)
 *   2) Label-based inference from sat_pdf_module_label / content / passage
 *   3) State machine: propagate the last confidently-detected module forward
 *   4) six_module M2 positional split from userModuleCounts when variant is still null
 *   5) Fallback to Module 1 (never drop the question)
 *
 * The returned buckets carry force-tagged questions via applyBucketToQuestion.
 */
export function splitSectionQuestionsIntoBuckets<T extends SplitInputQuestion>(
  questions: T[],
  section: SatSection,
  adaptiveMode: SatAdaptiveMode,
  opts?: SplitBucketOptions
): SplitBucketResult<T> {
  const buckets: Array<{ bucket: SatModuleBucket; questions: T[] }> =
    adaptiveMode === "six_module"
      ? [
          { bucket: { section, module: 1, variant: null, pdfLabels: [] }, questions: [] },
          { bucket: { section, module: 2, variant: "easy", pdfLabels: [] }, questions: [] },
          { bucket: { section, module: 2, variant: "hard", pdfLabels: [] }, questions: [] },
        ]
      : [
          { bucket: { section, module: 1, variant: null, pdfLabels: [] }, questions: [] },
          { bucket: { section, module: 2, variant: null, pdfLabels: [] }, questions: [] },
        ];

  const findBucket = (
    modNum: 1 | 2,
    variant: SatModuleVariant | null
  ): { bucket: SatModuleBucket; questions: T[] } => {
    if (adaptiveMode === "six_module") {
      if (modNum === 1) return buckets[0];
      if (variant === "easy") return buckets[1];
      if (variant === "hard") return buckets[2];
      return buckets[1];
    }
    return modNum === 1 ? buckets[0] : buckets[1];
  };

  let lastModule: 1 | 2 = 1;
  const tagged: TaggedQuestion<T>[] = [];

  for (const q of questions) {
    let modNum = normalizeModuleValue(q.sat_module);
    let variant = normalizeVariantValue(q.sat_module_variant);

    const label = pickLabelFromQuestion(q);
    if (label) {
      const labelModule = inferModuleNumberFromLabel(label);
      const labelVariant = inferVariantFromLabel(label);
      if (modNum == null && labelModule != null) modNum = labelModule;
      if (variant == null && labelVariant != null) variant = labelVariant;
      if (labelModule != null) modNum = labelModule;
      if (labelVariant != null && (modNum === 2 || labelModule === 2)) {
        variant = labelVariant;
        modNum = 2;
      }
    }

    if (modNum == null) modNum = lastModule;
    if (adaptiveMode !== "six_module") {
      variant = null;
    }

    lastModule = modNum;
    tagged.push({ q, modNum, variant });
  }

  if (adaptiveMode === "six_module") {
    assignSixModuleVariants(tagged, section, opts?.userModuleCounts);
  }

  for (const { q, modNum, variant } of tagged) {
    const target = findBucket(modNum, variant);
    const applied = applyBucketToQuestion(q as unknown as object, target.bucket) as unknown as T;
    target.questions.push(applied);
  }

  const m2RebalanceMoved =
    adaptiveMode === "six_module"
      ? rebalanceSixModuleM2Buckets(buckets, section, opts?.userModuleCounts)
      : 0;

  return { buckets, m2RebalanceMoved };
}

/** Kept only for downstream typing / test compatibility. */
export function bucketKeyForLegacy(bucket: SatModuleBucket): string {
  return bucketKey(bucket);
}
