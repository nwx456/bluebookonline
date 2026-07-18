import type { Part } from "@google/generative-ai";
import type { SatAdaptiveMode, SatFormat, SatSection } from "@/lib/exam-program";
import { isSatFullTest } from "@/lib/exam-program";
import { getSystemPrompt, type SubjectKey } from "@/lib/gemini-prompts";
import { runSatApStyleExtraction } from "@/lib/sat-ap-style-extract";
import {
  dedupeSatBucketQuestions,
  dedupeSatSectionCrossBucketQuestions,
  sectionCrossBucketFingerprint,
} from "@/lib/sat-bucket-dedupe";
import {
  applySatIngestPostProcess,
  partitionSatStemAndPassage,
} from "@/lib/sat-ingest-postprocess";
import {
  detectPdfSectionMismatchProse,
  isModelEmptyArrayFailure,
  type ParseFailureReason,
  type SatGeminiExtractQuestion,
} from "@/lib/sat-gemini-extract";
import {
  dropRowsWithoutSection,
  salvageFilterSatQuestions,
} from "@/lib/sat-question-filter";
import {
  auditSatModuleBoundaries,
  buildSatExtractionPlan,
  buildSatModuleExtractionPrompt,
  buildSatSectionExtractionPrompt,
  bucketNeedsSupplementalExtract,
  splitSectionQuestionsIntoBuckets,
  type SatStructureDetected,
} from "@/lib/sat-extraction";
import {
  applyBucketToQuestion,
  bucketKey,
  questionMatchesBucketLabel,
  type SatModuleBucket,
} from "@/lib/sat-module-normalizer";
import {
  sectionPhaseId,
  type createPhaseTracker,
} from "@/lib/upload-analyze-progress";

export type SatSectionExtractor = (args: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  pdfPart: Part;
  maxOutputTokens?: number;
  temperature?: number;
}) => Promise<{
  questions: SatGeminiExtractQuestion[];
  rawText: string;
  failureReason?: ParseFailureReason | string;
}>;

export interface SatSingleShotInput {
  subject: string;
  satFormat: SatFormat;
  sectionFilter: SatSection | null;
  effectiveAdaptiveMode: SatAdaptiveMode;
  userModuleCounts: Record<string, number> | null;
  systemInstruction: string;
  apiKey: string;
  pdfPart: Part;
  tracker: ReturnType<typeof createPhaseTracker> | null;
  extractor?: SatSectionExtractor;
}

export interface SatSingleShotResult {
  questions: SatGeminiExtractQuestion[];
  rawAggregate: string[];
  structureDetected: SatStructureDetected;
  modeMismatchWarning: string | null;
  detectedStructureSummary: string | undefined;
  bucketCountsDuringExtract: Record<string, number>;
  bucketCountsAfterFilter: Record<string, number>;
  auditWarnings: string[];
  extractionErrorCode?: "MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH";
  extractionError?: string;
}

/** Re-export pipeline types for backward compatibility. */
export type SatSectionPipelineInput = SatSingleShotInput;
export type SatSectionPipelineResult = SatSingleShotResult;

const MAX_OUTPUT_TOKENS = 32768;

function expectedCountsForSection(
  section: SatSection,
  adaptiveMode: SatAdaptiveMode,
  userModuleCounts: Record<string, number> | null
): {
  m1?: number;
  m2?: number;
  m2Easy?: number;
  m2Hard?: number;
} {
  if (!userModuleCounts) return {};
  if (section === "rw") {
    if (adaptiveMode === "six_module") {
      return {
        m1: userModuleCounts.rw1,
        m2Easy: userModuleCounts.rw2easy,
        m2Hard: userModuleCounts.rw2hard,
      };
    }
    return { m1: userModuleCounts.rw1, m2: userModuleCounts.rw2 };
  }
  if (adaptiveMode === "six_module") {
    return {
      m1: userModuleCounts.math1,
      m2Easy: userModuleCounts.math2easy,
      m2Hard: userModuleCounts.math2hard,
    };
  }
  return { m1: userModuleCounts.math1, m2: userModuleCounts.math2 };
}

/** User prompt for single_module SAT_RW / SAT_MATH uploads. */
export function buildSatSingleModuleUserPrompt(opts: {
  subject: string;
  userModuleCounts: Record<string, number> | null;
  questionCount: number | null;
}): string {
  const { subject, userModuleCounts, questionCount } = opts;
  if (subject === "SAT_RW") {
    const rwTarget = userModuleCounts?.rw1 ?? questionCount ?? 27;
    return `Analyze the attached SAT Reading & Writing PDF and extract exactly ${rwTarget} multiple-choice questions (required count: ${rwTarget}; do not return fewer than ${rwTarget} and do not exceed ${rwTarget + 1}). If the PDF has no module headings (single practice sheet), treat every question as sat_module=1 and extract ALL visible MCQs in order. Each object: "type" ("text"), "content" (ONLY the question stem), "image_description" (passage / excerpt; or null), "options" (a JSON array of exactly 4 FULL-TEXT strings A,B,C,D), "correct" (A/B/C/D from the PDF answer key or null; do NOT guess), "question_type": "mcq", "sat_section": "rw" (MANDATORY), "sat_module": 1 or 2 from the PDF header (single-module practice = 1; MANDATORY, never null), "sat_module_variant": null, "sat_difficulty": null, "accepted_answers": null. NO E option ever. Do NOT include has_graph/page_number/bbox. Return only the JSON array.`;
  }
  const mathTarget = userModuleCounts?.math1 ?? questionCount ?? 22;
  return `Analyze the attached SAT Math PDF and extract exactly ${mathTarget} questions (required count: ${mathTarget}; do not return fewer than ${mathTarget} and do not exceed ${mathTarget + 1}; MCQ + grid-in). Each object: "type" ("text" | "image"), "content" (question text), "image_description" (figure description or null), "has_graph" (boolean), "page_number" (1-based when has_graph is true), "bbox" (0-1 normalized when has_graph is true), "options" (MCQ: 4 FULL-TEXT strings A,B,C,D; grid-in: []), "correct" (A/B/C/D for MCQ OR numeric string like "3/2" for grid-in OR null; do NOT guess), "question_type" ("mcq" | "grid_in"), "accepted_answers" (string array of equivalent numeric forms for grid-in; null for MCQ), "sat_section": "math" (MANDATORY), "sat_module": 1 or 2 (MANDATORY, never null), "sat_module_variant": null, "sat_difficulty": null. NO E option ever. Return only the JSON array.`;
}

/** Section-level prompt for section_test / full_test (one Gemini call per section). */
export function buildSatSectionUserPrompt(
  section: SatSection,
  opts: {
    adaptiveMode: SatAdaptiveMode;
    userModuleCounts: Record<string, number> | null;
  }
): string {
  return buildSatSectionExtractionPrompt(section, {
    adaptiveMode: opts.adaptiveMode,
    expectedCounts: expectedCountsForSection(
      section,
      opts.adaptiveMode,
      opts.userModuleCounts
    ),
    retry: false,
  });
}

function usesDefaultExtractor(
  extractor: SatSectionExtractor | undefined
): boolean {
  return extractor == null || extractor === runSatApStyleExtraction;
}

function systemInstructionForSection(
  section: SatSection,
  adaptiveMode: SatAdaptiveMode,
  fallback: string,
  ctx: { subject: string; satFormat: SatFormat },
  extractor?: SatSectionExtractor
): string {
  if (!usesDefaultExtractor(extractor)) {
    return fallback;
  }
  const sectionSubject = section === "rw" ? "SAT_RW" : "SAT_MATH";
  const promptFormat: SatFormat = isSatFullTest(ctx.subject)
    ? "full_test"
    : ctx.satFormat;
  return getSystemPrompt(sectionSubject as SubjectKey, section === "math", {
    satAdaptiveMode: adaptiveMode,
    satFormat: promptFormat,
  });
}

function resolveExtractionError(
  section: SatSection,
  rawTexts: string[],
  failureReason?: ParseFailureReason | string
): { code: "MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH"; message: string } | null {
  const combined = rawTexts.join("\n");
  if (detectPdfSectionMismatchProse(combined)) {
    const isMathOnRwOnly =
      section === "math" &&
      (combined.toLowerCase().includes("reading") ||
        combined.toLowerCase().includes("yalnızca"));
    return {
      code: "PDF_SECTION_MISMATCH",
      message: isMathOnRwOnly
        ? "PDF yalnızca Reading & Writing içeriyor. SAT Reading & Writing + Single practice sheet seçin veya Full Test yerine bölüm yükleyin."
        : "PDF seçilen bölümle eşleşmiyor. Subject ve PDF structure ayarlarını kontrol edin.",
    };
  }
  if (
    isModelEmptyArrayFailure(
      (failureReason as ParseFailureReason) ?? "parse_error",
      0
    )
  ) {
    return {
      code: "MODEL_EMPTY_ARRAY",
      message:
        "AI PDF'ten soru bulamadı. Taranmış PDF, yanlış format veya Single practice sheet seçeneğini deneyin.",
    };
  }
  return null;
}

function processBucketQuestions(
  bucketQuestions: SatGeminiExtractQuestion[],
  section: SatSection
): SatGeminiExtractQuestion[] {
  for (const q of bucketQuestions) {
    applySatIngestPostProcess(q, { section });
    if (section === "rw") {
      const stem = (
        typeof q.content === "string"
          ? q.content
          : typeof q.question === "string"
            ? q.question
            : ""
      ).trim();
      const passage =
        typeof q.image_description === "string" ? q.image_description : null;
      const part = partitionSatStemAndPassage(stem, passage, "rw");
      q.content = part.stem;
      q.image_description = part.passage;
    }
  }
  const { kept } = salvageFilterSatQuestions(bucketQuestions);
  return dropRowsWithoutSection(kept);
}

async function extractOneSectionSingleShot(
  section: SatSection,
  ctx: SatSingleShotInput,
  extractor: SatSectionExtractor
): Promise<{
  questions: SatGeminiExtractQuestion[];
  rawTexts: string[];
  extractionError?: { code: "MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH"; message: string };
}> {
  const systemInstruction = systemInstructionForSection(
    section,
    ctx.effectiveAdaptiveMode,
    ctx.systemInstruction,
    { subject: ctx.subject, satFormat: ctx.satFormat },
    ctx.extractor
  );
  const userPrompt = buildSatSectionUserPrompt(section, {
    adaptiveMode: ctx.effectiveAdaptiveMode,
    userModuleCounts: ctx.userModuleCounts,
  });

  const result = await extractor({
    apiKey: ctx.apiKey,
    systemInstruction,
    userPrompt,
    pdfPart: ctx.pdfPart,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
  });

  const rawTexts = [result.rawText];

  if (detectPdfSectionMismatchProse(result.rawText)) {
    const err = resolveExtractionError(section, rawTexts, result.failureReason);
    return { questions: [], rawTexts, extractionError: err ?? undefined };
  }

  if (
    result.questions.length === 0 &&
    isModelEmptyArrayFailure(
      (result.failureReason as ParseFailureReason) ?? "parse_error",
      0
    )
  ) {
    const err = resolveExtractionError(section, rawTexts, result.failureReason);
    return { questions: [], rawTexts, extractionError: err ?? undefined };
  }

  return { questions: result.questions, rawTexts };
}

function isFullTestPdfContext(ctx: SatSingleShotInput): boolean {
  return ctx.satFormat === "full_test" && ctx.sectionFilter == null;
}

function filterQuestionsBySectionFingerprints<T extends SatGeminiExtractQuestion>(
  questions: T[],
  section: SatSection,
  seenFingerprints: Set<string>
): T[] {
  const out: T[] = [];
  for (const q of questions) {
    const fp = sectionCrossBucketFingerprint(q, section);
    if (fp && seenFingerprints.has(fp)) continue;
    out.push(q);
  }
  return out;
}

function registerSectionFingerprints<T extends SatGeminiExtractQuestion>(
  questions: T[],
  section: SatSection,
  seenFingerprints: Set<string>
): void {
  for (const q of questions) {
    const fp = sectionCrossBucketFingerprint(q, section);
    if (fp) seenFingerprints.add(fp);
  }
}

function tagBucketQuestions(
  questions: SatGeminiExtractQuestion[],
  bucket: SatModuleBucket
): SatGeminiExtractQuestion[] {
  return questions
    .filter((q) => questionMatchesBucketLabel(q, bucket))
    .map(
      (q) =>
        applyBucketToQuestion(
          q as unknown as object,
          bucket
        ) as unknown as SatGeminiExtractQuestion
    );
}

async function extractOneBucket(
  bucket: SatModuleBucket,
  section: SatSection,
  ctx: SatSingleShotInput,
  extractor: SatSectionExtractor,
  retry: boolean,
  seenFingerprints: Set<string>
): Promise<{
  questions: SatGeminiExtractQuestion[];
  rawText: string;
  failureReason?: ParseFailureReason | string;
}> {
  const systemInstruction = systemInstructionForSection(
    section,
    ctx.effectiveAdaptiveMode,
    ctx.systemInstruction,
    { subject: ctx.subject, satFormat: ctx.satFormat },
    ctx.extractor
  );
  const userPrompt = buildSatModuleExtractionPrompt(bucket, {
    adaptiveMode: ctx.effectiveAdaptiveMode,
    retry,
    isFullTestPdf: isFullTestPdfContext(ctx),
  });

  const result = await extractor({
    apiKey: ctx.apiKey,
    systemInstruction,
    userPrompt,
    pdfPart: ctx.pdfPart,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
  });

  const fresh = filterQuestionsBySectionFingerprints(
    result.questions,
    section,
    seenFingerprints
  );
  const tagged = tagBucketQuestions(fresh, bucket);

  return {
    questions: tagged,
    rawText: result.rawText,
    failureReason: result.failureReason,
  };
}

async function extractOneSectionSixModule(
  section: SatSection,
  ctx: SatSingleShotInput,
  extractor: SatSectionExtractor
): Promise<{
  questions: SatGeminiExtractQuestion[];
  rawTexts: string[];
  bucketCountsDuringExtract: Record<string, number>;
  bucketCountsAfterFilter: Record<string, number>;
  extractionError?: { code: "MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH"; message: string };
}> {
  const plan = buildSatExtractionPlan(
    "six_module",
    ctx.sectionFilter,
    ctx.userModuleCounts
  ).filter((b) => b.section === section);

  const bucketCountsDuringExtract: Record<string, number> = {};
  const bucketCountsAfterFilter: Record<string, number> = {};
  const allQuestions: SatGeminiExtractQuestion[] = [];
  const rawTexts: string[] = [];
  const seenFingerprints = new Set<string>();
  let anyBucketHadQuestions = false;

  for (const bucket of plan) {
    const label = bucketKey(bucket);
    const expected = bucket.expectedCount ?? 0;

    let bucketRaw = await extractOneBucket(
      bucket,
      section,
      ctx,
      extractor,
      false,
      seenFingerprints
    );
    rawTexts.push(bucketRaw.rawText);

    if (detectPdfSectionMismatchProse(bucketRaw.rawText)) {
      const err = resolveExtractionError(section, rawTexts, bucketRaw.failureReason);
      if (err) return { questions: [], rawTexts, bucketCountsDuringExtract, bucketCountsAfterFilter, extractionError: err };
    }

    let geminiRaw = bucketRaw.questions.length;
    let mergedTagged = [...bucketRaw.questions];

    let afterSalvage = processBucketQuestions(mergedTagged, section);
    let processed = dedupeSatBucketQuestions(afterSalvage);
    let supplementAdded = 0;

    if (bucketNeedsSupplementalExtract(processed.length, expected)) {
      const retryRaw = await extractOneBucket(
        bucket,
        section,
        ctx,
        extractor,
        true,
        seenFingerprints
      );
      rawTexts.push(retryRaw.rawText);
      geminiRaw += retryRaw.questions.length;
      mergedTagged = [...mergedTagged, ...retryRaw.questions];
      const beforeSupplement = processed.length;
      afterSalvage = processBucketQuestions(mergedTagged, section);
      processed = dedupeSatBucketQuestions(afterSalvage);
      supplementAdded = Math.max(0, processed.length - beforeSupplement);

      if (process.env.NODE_ENV === "development" && supplementAdded > 0) {
        console.info(
          `[sat-single-shot] section=${section} bucket=${label} supplement retry kept=+${supplementAdded}`
        );
      }
    }

    registerSectionFingerprints(processed, section, seenFingerprints);

    bucketCountsDuringExtract[label] = geminiRaw;
    bucketCountsAfterFilter[label] = processed.length;
    allQuestions.push(...processed);
    if (processed.length > 0) anyBucketHadQuestions = true;

    if (process.env.NODE_ENV === "development") {
      const dedupeDropped = afterSalvage.length - processed.length;
      console.info(
        `[sat-single-shot] section=${section} bucket=${label}: geminiRaw=${geminiRaw} afterSalvage=${afterSalvage.length} afterDedupe=${processed.length} dedupeDropped=${dedupeDropped} supplement=+${supplementAdded}`
      );
    }
  }

  const { kept: dedupedQuestions, dropped: crossBucketDropped } =
    dedupeSatSectionCrossBucketQuestions(allQuestions);

  if (crossBucketDropped > 0) {
    for (const bucket of plan) {
      const label = bucketKey(bucket);
      bucketCountsAfterFilter[label] = dedupedQuestions.filter((q) => {
        const qSection = q.sat_section === "math" ? "math" : "rw";
        if (qSection !== bucket.section) return false;
        const mod = q.sat_module === 2 ? 2 : 1;
        if (mod !== bucket.module) return false;
        const variant =
          q.sat_module_variant === "easy" || q.sat_module_variant === "hard"
            ? q.sat_module_variant
            : null;
        return variant === bucket.variant;
      }).length;
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[sat-single-shot] section=${section} crossBucketDedupe dropped=${crossBucketDropped} kept=${dedupedQuestions.length}`
      );
    }
  }

  if (!anyBucketHadQuestions) {
    const err = resolveExtractionError(section, rawTexts, "valid_array");
    if (err) {
      return {
        questions: [],
        rawTexts,
        bucketCountsDuringExtract,
        bucketCountsAfterFilter,
        extractionError: err,
      };
    }
  }

  return {
    questions: dedupedQuestions,
    rawTexts,
    bucketCountsDuringExtract,
    bucketCountsAfterFilter,
  };
}

/**
 * AP-style SAT extraction: one call per section (none adaptive) or per-bucket (six_module).
 */
export async function runSatSingleShotExtract(
  ctx: SatSingleShotInput
): Promise<SatSingleShotResult> {
  const rawAggregate: string[] = [];
  const bucketCountsDuringExtract: Record<string, number> = {};
  const bucketCountsAfterFilter: Record<string, number> = {};
  const extractor: SatSectionExtractor = ctx.extractor ?? runSatApStyleExtraction;

  const sections: SatSection[] =
    ctx.sectionFilter == null ? ["rw", "math"] : [ctx.sectionFilter];

  const allQuestions: SatGeminiExtractQuestion[] = [];
  let extractionErrorCode: SatSingleShotResult["extractionErrorCode"];
  let extractionError: string | undefined;
  let rwSectionHadQuestions = false;

  for (const section of sections) {
    const phaseId = sectionPhaseId(section);
    ctx.tracker?.start(phaseId);

    if (ctx.effectiveAdaptiveMode === "six_module") {
      const {
        questions: sectionQuestions,
        rawTexts,
        bucketCountsDuringExtract: sectionBucketParsed,
        bucketCountsAfterFilter: sectionBucketKept,
        extractionError: sectionErr,
      } = await extractOneSectionSixModule(section, ctx, extractor);

      for (const rt of rawTexts) {
        rawAggregate.push(
          `--- section:${section} bucket (raw len=${rt.length}) ---\n${rt.slice(0, 2000)}`
        );
      }
      Object.assign(bucketCountsDuringExtract, sectionBucketParsed);
      Object.assign(bucketCountsAfterFilter, sectionBucketKept);
      allQuestions.push(...sectionQuestions);

      if (section === "rw" && sectionQuestions.length > 0) {
        rwSectionHadQuestions = true;
      }

      if (sectionErr) {
        extractionErrorCode = sectionErr.code;
        extractionError = sectionErr.message;
        if (
          sectionErr.code === "PDF_SECTION_MISMATCH" &&
          section === "math" &&
          ctx.sectionFilter == null &&
          rwSectionHadQuestions
        ) {
          ctx.tracker?.done(phaseId, "0 questions — PDF has no Math section");
          break;
        }
        ctx.tracker?.done(phaseId, sectionErr.message);
        break;
      }

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[sat-single-shot] section=${section} total kept=${sectionQuestions.length} (six_module per-bucket)`
        );
      }

      ctx.tracker?.done(
        phaseId,
        `${sectionQuestions.length} questions across ${Object.keys(sectionBucketKept).length} modules`
      );
      continue;
    }

    const { questions: sectionRaw, rawTexts, extractionError: sectionErr } =
      await extractOneSectionSingleShot(section, ctx, extractor);

    for (const rt of rawTexts) {
      rawAggregate.push(
        `--- section:${section} (raw len=${rt.length}) ---\n${rt.slice(0, 2000)}`
      );
    }

    if (section === "rw" && sectionRaw.length > 0) {
      rwSectionHadQuestions = true;
    }

    if (sectionErr) {
      extractionErrorCode = sectionErr.code;
      extractionError = sectionErr.message;
      if (
        sectionErr.code === "PDF_SECTION_MISMATCH" &&
        section === "math" &&
        ctx.sectionFilter == null &&
        rwSectionHadQuestions
      ) {
        ctx.tracker?.done(phaseId, "0 questions — PDF has no Math section");
        break;
      }
      ctx.tracker?.done(phaseId, sectionErr.message);
      break;
    }

    const { buckets, m2RebalanceMoved } = splitSectionQuestionsIntoBuckets(
      sectionRaw,
      section,
      ctx.effectiveAdaptiveMode,
      { userModuleCounts: ctx.userModuleCounts }
    );

    if (process.env.NODE_ENV === "development" && m2RebalanceMoved > 0) {
      console.info(
        `[sat-single-shot] section=${section} m2RebalanceMoved=${m2RebalanceMoved}`
      );
    }

    let sectionKept = 0;
    for (const b of buckets) {
      const label = `${b.bucket.section}${b.bucket.module}${b.bucket.variant ?? ""}`;
      const parsed = b.questions.length;
      bucketCountsDuringExtract[label] = parsed;
      const afterSalvage = processBucketQuestions(b.questions, section);
      const processed = dedupeSatBucketQuestions(afterSalvage);
      const dedupeDropped = afterSalvage.length - processed.length;
      bucketCountsAfterFilter[label] = processed.length;
      allQuestions.push(...processed);
      sectionKept += processed.length;

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[sat-single-shot] section=${section} bucket=${label}: parsed=${parsed} afterSalvage=${afterSalvage.length} afterDedupe=${processed.length} dedupeDropped=${dedupeDropped} rebalanceMoved=${m2RebalanceMoved}`
        );
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[sat-single-shot] section=${section} total parsed=${sectionRaw.length} kept=${sectionKept}`
      );
    }

    ctx.tracker?.done(
      phaseId,
      `${sectionKept} questions across ${buckets.length} module${
        buckets.length === 1 ? "" : "s"
      }`
    );
  }

  const questions = allQuestions;
  const auditWarnings = auditSatModuleBoundaries(
    questions,
    ctx.effectiveAdaptiveMode
  );

  return {
    questions,
    rawAggregate,
    structureDetected: null,
    modeMismatchWarning: null,
    detectedStructureSummary: undefined,
    bucketCountsDuringExtract,
    bucketCountsAfterFilter,
    auditWarnings,
    extractionErrorCode,
    extractionError,
  };
}

/** Backward-compatible alias. */
export const runSatSectionExtractPipeline = runSatSingleShotExtract;

export type SatBucketExtractor = SatSectionExtractor;
export type SatBucketPipelineInput = SatSingleShotInput;
export type SatBucketPipelineResult = SatSingleShotResult;
export const runSatBucketExtractPipeline = runSatSingleShotExtract;
