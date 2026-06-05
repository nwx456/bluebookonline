import type { SatAdaptiveMode, SatModuleId, SatSection } from "@/lib/exam-program";
import type { SatModuleBucket } from "@/lib/sat-module-normalizer";
import { buildBucketPromptLabels } from "@/lib/sat-module-normalizer";

export interface SatStructureBlock {
  detectedTitle: string;
  inferredModule: 1 | 2;
  inferredVariant: "easy" | "hard" | null;
  approxQuestionCount?: number;
}

export interface SatStructureSection {
  section: SatSection;
  blocks: SatStructureBlock[];
}

export interface SatStructureDetected {
  sections: SatStructureSection[];
  suggestedAdaptiveMode: SatAdaptiveMode;
  namingStyle?: string;
}

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
}

const SAT_MODULE_MIN: Record<SatSection, number> = { rw: 20, math: 18 };

function rwBuckets(): SatModuleBucket[] {
  return [
    { section: "rw", module: 1, variant: null, pdfLabels: [] },
    { section: "rw", module: 2, variant: "easy", pdfLabels: [] },
    { section: "rw", module: 2, variant: "hard", pdfLabels: [] },
  ];
}

function mathBuckets(): SatModuleBucket[] {
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

function findDetectedTitle(
  structure: SatStructureDetected | null | undefined,
  bucket: SatModuleBucket
): string | null {
  if (!structure?.sections) return null;
  const sec = structure.sections.find((s) => s.section === bucket.section);
  if (!sec) return null;
  const match = sec.blocks.find(
    (b) =>
      b.inferredModule === bucket.module &&
      (bucket.variant == null
        ? b.inferredVariant == null
        : b.inferredVariant === bucket.variant)
  );
  return match?.detectedTitle ?? null;
}

export function buildSatExtractionPlan(
  adaptiveMode: SatAdaptiveMode,
  structure?: SatStructureDetected | null,
  sectionFilter?: SatSection | null
): SatModuleBucket[] {
  const base =
    adaptiveMode === "six_module"
      ? [...rwBuckets(), ...mathBuckets()]
      : fourModuleBuckets();

  const filtered = sectionFilter
    ? base.filter((b) => b.section === sectionFilter)
    : base;

  return filtered.map((bucket) => ({
    ...bucket,
    detectedTitle: findDetectedTitle(structure, bucket),
  }));
}

export function buildStructureDiscoveryPrompt(): string {
  return `Scan this Digital SAT practice PDF and return ONLY a JSON object (no markdown) describing its module structure.

IMPORTANT: MCQ answer choices labeled A, B, C, D are NOT module names. Only section/module HEADINGS count.

Headings may appear in English, Turkish, Spanish, German, French, Portuguese, Arabic, or Chinese.
Example detectedTitle values: "Module 1", "Modül A", "Módulo B", "Modul 1", "Module facile", "Module difficile", "模块 1", "وحدة 1".

Map PDF labels to canonical form:
- First module in each section → inferredModule: 1, inferredVariant: null
- Second-stage adaptive path (Module A, Easy, Below the bar, Módulo A, Modul A, Module facile, 模块 A, وحدة أ) → inferredModule: 2, inferredVariant: "easy"
- Second-stage adaptive path (Module B, Hard, Above the bar, Módulo B, Modul B, Module difficile, 模块 B, وحدة ب) → inferredModule: 2, inferredVariant: "hard"
- Single second module (Module 2 only) → inferredModule: 2, inferredVariant: null

Schema:
{
  "sections": [
    {
      "section": "rw" | "math",
      "blocks": [
        {
          "detectedTitle": "exact heading text from PDF",
          "inferredModule": 1 | 2,
          "inferredVariant": "easy" | "hard" | null,
          "approxQuestionCount": number
        }
      ]
    }
  ],
  "suggestedAdaptiveMode": "none" | "pool" | "six_module",
  "namingStyle": "module_12" | "module_letter_ab" | "easy_hard" | "mixed" | "localized"
}

Rules for suggestedAdaptiveMode:
- six_module: each section has Module 1 + two second-stage paths (A/B or Easy/Hard)
- none: each section has exactly Module 1 and Module 2 (no A/B split)
- pool: second modules tagged with difficulty pool`;
}

export function parseStructureDiscovery(raw: string): SatStructureDetected | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const sectionsRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections: SatStructureSection[] = [];
  for (const s of sectionsRaw) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const section = sec.section === "math" ? "math" : sec.section === "rw" ? "rw" : null;
    if (!section) continue;
    const blocksRaw = Array.isArray(sec.blocks) ? sec.blocks : [];
    const blocks: SatStructureBlock[] = [];
    for (const b of blocksRaw) {
      if (!b || typeof b !== "object") continue;
      const block = b as Record<string, unknown>;
      const inferredModule = block.inferredModule === 2 ? 2 : block.inferredModule === 1 ? 1 : null;
      if (!inferredModule) continue;
      const iv = block.inferredVariant;
      const inferredVariant = iv === "easy" || iv === "hard" ? iv : null;
      blocks.push({
        detectedTitle: String(block.detectedTitle ?? "").trim() || "Unknown",
        inferredModule,
        inferredVariant,
        approxQuestionCount:
          typeof block.approxQuestionCount === "number"
            ? block.approxQuestionCount
            : undefined,
      });
    }
    if (blocks.length > 0) sections.push({ section, blocks });
  }
  const modeRaw = o.suggestedAdaptiveMode;
  const suggestedAdaptiveMode: SatAdaptiveMode =
    modeRaw === "six_module" || modeRaw === "pool" ? modeRaw : "none";
  return {
    sections,
    suggestedAdaptiveMode,
    namingStyle: typeof o.namingStyle === "string" ? o.namingStyle : undefined,
  };
}

export function getModeMismatchWarning(
  selectedMode: SatAdaptiveMode,
  structure: SatStructureDetected | null | undefined
): string | null {
  if (!structure?.suggestedAdaptiveMode) return null;
  if (structure.suggestedAdaptiveMode === selectedMode) return null;
  const detected = structure.suggestedAdaptiveMode;
  const labels = structure.sections
    .flatMap((s) => s.blocks.map((b) => b.detectedTitle))
    .filter(Boolean)
    .slice(0, 6)
    .join("; ");
  if (detected === "six_module" && selectedMode === "none") {
    return `PDF appears to use 6 modules (Module 1 + A/B or Easy/Hard). Select "Six-module adaptive". Detected: ${labels || "see structure"}.`;
  }
  if (detected === "none" && selectedMode === "six_module") {
    return `PDF appears to use 4 classic modules. "Non-adaptive" may work better. Detected: ${labels || "see structure"}.`;
  }
  return `PDF structure suggests "${detected}" but you selected "${selectedMode}".`;
}

export function getDetectedLabels(
  structure: SatStructureDetected | null | undefined
): string[] {
  if (!structure) return [];
  return structure.sections.flatMap((s) =>
    s.blocks.map((b) => `${s.section.toUpperCase()}: ${b.detectedTitle}`)
  );
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
    const module = normModule(q.sat_module);
    if (!section || !module) continue;
    const variant = normVariant(q.sat_module_variant);

    if (section === "rw" && module === 1) report.rw1++;
    if (section === "rw" && module === 2) {
      report.rw2++;
      if (variant === "easy") report.rw2Easy++;
      if (variant === "hard") report.rw2Hard++;
    }
    if (section === "math" && module === 1) report.math1++;
    if (section === "math" && module === 2) {
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

export function validateSatModuleReport(
  report: SatModuleReport,
  adaptiveMode: SatAdaptiveMode,
  structure?: SatStructureDetected | null,
  sectionFilter?: SatSection | null
): SatValidationResult {
  const emptyBucketKeys: string[] = [];
  const detectedTitles = sectionFilter
    ? getDetectedLabels(structure).filter((l) =>
        l.toUpperCase().startsWith(sectionFilter.toUpperCase())
      )
    : getDetectedLabels(structure);

  const checkRw = !sectionFilter || sectionFilter === "rw";
  const checkMath = !sectionFilter || sectionFilter === "math";

  if (adaptiveMode === "six_module") {
    if (checkRw && report.rw1 < SAT_MODULE_MIN.rw) emptyBucketKeys.push("rw1");
    if (checkMath && report.math1 < SAT_MODULE_MIN.math) emptyBucketKeys.push("math1");
    if (checkRw && report.rw2Easy + report.rw2Hard < SAT_MODULE_MIN.rw) {
      emptyBucketKeys.push("rw2Easy", "rw2Hard");
    }
    if (checkMath && report.math2Easy + report.math2Hard < SAT_MODULE_MIN.math) {
      emptyBucketKeys.push("math2Easy", "math2Hard");
    }
    if (emptyBucketKeys.length === 0) return { ok: true };

    const hint =
      checkRw && report.rw2Easy + report.rw2Hard === 0 && report.rw2 === 0
        ? " R&W Module A/B (or Easy/Hard) not found — select Six-module adaptive and ensure PDF has second-stage modules."
        : checkMath && report.math2Easy + report.math2Hard === 0 && report.math2 === 0
          ? " Math Module A/B (or Easy/Hard) not found — select Six-module adaptive and ensure PDF has second-stage modules."
          : "";
    const scope = sectionFilter
      ? sectionFilter === "rw"
        ? "Reading & Writing"
        : "Math"
      : "SAT";
    return {
      ok: false,
      emptyBucketKeys,
      error: `PDF'ten ${scope} modülleri çıkarılamadı. Eksik: ${emptyBucketKeys.join(", ")}.${hint}${
        detectedTitles.length ? ` PDF başlıkları: ${detectedTitles.join("; ")}.` : ""
      } PDF'i tekrar yükleyin veya modül formatını kontrol edin.`,
    };
  }

  if (checkRw && report.rw1 < SAT_MODULE_MIN.rw) emptyBucketKeys.push("rw1");
  if (checkRw && report.rw2 < SAT_MODULE_MIN.rw) emptyBucketKeys.push("rw2");
  if (checkMath && report.math1 < SAT_MODULE_MIN.math) emptyBucketKeys.push("math1");
  if (checkMath && report.math2 < SAT_MODULE_MIN.math) emptyBucketKeys.push("math2");

  if (emptyBucketKeys.length === 0) return { ok: true };

  const sixHint =
    structure?.suggestedAdaptiveMode === "six_module"
      ? " PDF 6 modül (Module A/B) içeriyor olabilir — Six-module adaptive seçin."
      : checkMath &&
          report.rw2 === 0 &&
          report.math2 > SAT_MODULE_MIN.math * 1.5
        ? " Math M2 çift görünüyor — Six-module adaptive deneyin."
        : "";

  const scope = sectionFilter
    ? sectionFilter === "rw"
      ? "Reading & Writing"
      : "Math"
    : "SAT";

  return {
    ok: false,
    emptyBucketKeys,
    error: `PDF'ten ${scope} modülleri çıkarılamadı. Boş modüller: ${emptyBucketKeys.join(", ")}.${sixHint}${
      detectedTitles.length ? ` Tespit: ${detectedTitles.join("; ")}.` : ""
    } PDF'i tekrar yükleyin veya modül formatını kontrol edin.`,
  };
}

const MCQ_VS_MODULE_RULE =
  "CRITICAL: Multiple-choice answer options A, B, C, D are NOT module identifiers. Only section/module HEADINGS identify modules.";

export function buildSatBucketExtractionPrompt(
  bucket: SatModuleBucket,
  opts: {
    adaptiveMode: SatAdaptiveMode;
    priorModuleCount?: number;
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

  const poolHint =
    opts.adaptiveMode === "pool" && bucket.module === 2
      ? `Set "sat_difficulty" on each question to "easy" | "medium" | "hard".`
      : `"sat_difficulty": null`;

  const priorHint =
    bucket.module === 2 &&
    opts.priorModuleCount != null &&
    opts.priorModuleCount > 0
      ? `First module of this section had ~${opts.priorModuleCount} questions; this bucket should have a similar count.`
      : "";

  const retryHint = opts.retry
    ? "RETRY: Previous extraction returned too few questions. Scan the ENTIRE PDF again for this bucket only."
    : "";

  return `${MCQ_VS_MODULE_RULE}

Analyze the attached Digital SAT PDF and extract ONLY questions in this bucket:
${bucketDesc}

${labelGuide}

Every object MUST set "sat_section": "${bucket.section}", "sat_module": ${bucket.module}, ${variantField}, ${poolHint}
Include optional "sat_pdf_module_label" with the exact PDF heading for this block.
${priorHint}
${retryHint}

Return ONLY a JSON array. Each object: "type", "content", "image_description", "options" (4 full-text strings for MCQ, [] for grid-in), "correct", "question_type", "accepted_answers"${mathExtraFields}. NO option E.`;
}
