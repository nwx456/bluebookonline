import {
  SAT_MODULES,
  type SatAdaptiveMode,
  type SatModuleId,
  type SatSection,
} from "@/lib/exam-program";
import { buildBucketPromptLabels } from "@/lib/sat-module-normalizer";
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
    if (expected > 0 && actual > expected * 2) {
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

export function buildSatBucketExtractionPrompt(
  bucket: SatModuleBucket,
  opts: {
    adaptiveMode: SatAdaptiveMode;
    retry?: boolean;
  }
): string {
  const sectionLabel = bucket.section === "rw" ? "Reading & Writing" : "Math";
  const labelGuide = buildBucketPromptLabels(bucket);
  const mathExtraFields =
    bucket.section === "math"
      ? `, "has_graph" (boolean), "page_number" (1-based, only when has_graph is true), "bbox" (0-1 normalized {x,y,width,height}, only when has_graph is true)`
      : "";

  let bucketDesc: string;
  if (bucket.module === 1) {
    bucketDesc = `${sectionLabel} FIRST module (Module 1 / Module One / Part 1 — NOT answer choice letters)`;
  } else if (bucket.variant === "easy") {
    bucketDesc = `${sectionLabel} SECOND-STAGE EASY path ONLY (Module A / Easy / Below the bar — NOT Module 1, NOT Module B/Hard)`;
  } else if (bucket.variant === "hard") {
    bucketDesc = `${sectionLabel} SECOND-STAGE HARD path ONLY (Module B / Hard / Above the bar — NOT Module 1, NOT Module A/Easy)`;
  } else {
    bucketDesc = `${sectionLabel} SECOND module (Module 2 / Module B / Part 2 — single M2, not adaptive split)`;
  }

  const variantField =
    bucket.variant != null
      ? `"sat_module_variant": "${bucket.variant}"`
      : `"sat_module_variant": null`;

  const expected =
    bucket.expectedCount ?? defaultExpectedCount(bucket.section, bucket.module);

  const countHint = `Extract exactly ${expected} questions for this bucket (required count: ${expected}; do not return fewer than ${expected} and do not exceed ${expected + 2}).`;

  const stopHint =
    bucket.module === 1
      ? "STOP as soon as the next module heading appears (Module A/B, Module 2, Easy/Hard, Part 2). Do NOT include questions from any later module."
      : "IGNORE questions from Module 1 and from the OTHER second-stage variant.";

  const retryHint = opts.retry
    ? "RETRY: previous attempt returned zero questions for this bucket. Scan the PDF more carefully for this specific module heading."
    : "";

  return `${MCQ_VS_MODULE_RULE}

Analyze the attached Digital SAT PDF and extract ONLY questions in this bucket:
${bucketDesc}

${labelGuide}

${countHint}
${stopHint}

Every object MUST set "sat_section": "${bucket.section}", "sat_module": ${bucket.module}, ${variantField}, "sat_difficulty": null.
The "sat_section" and "sat_module" fields are MANDATORY and must never be null.
Include optional "sat_pdf_module_label" with the exact PDF heading for this block.
${retryHint}

If text is unreadable, transcribe from the PDF; never return empty option strings when A-D choices are visible in the PDF.

Return ONLY a JSON array. Each object: "type", "content", "image_description", "options" (4 full-text strings for MCQ, [] for grid-in), "correct", "question_type", "accepted_answers"${mathExtraFields}. NO option E.`;
}
