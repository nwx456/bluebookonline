import type { Part } from "@google/generative-ai";
import type { SatAdaptiveMode, SatSection } from "@/lib/exam-program";
import { dedupeSatBucketQuestions } from "@/lib/sat-bucket-dedupe";
import { applySatIngestPostProcess } from "@/lib/sat-ingest-postprocess";
import {
  runSatGeminiExtraction,
  type SatGeminiExtractQuestion,
} from "@/lib/sat-gemini-extract";
import {
  dropRowsWithoutSection,
  salvageFilterSatQuestions,
} from "@/lib/sat-question-filter";
import {
  auditSatModuleBoundaries,
  bucketExtractionNeedsRetry,
  buildSatSectionExtractionPrompt,
  splitSectionQuestionsIntoBuckets,
  type SatStructureDetected,
} from "@/lib/sat-extraction";
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
}) => Promise<{ questions: SatGeminiExtractQuestion[]; rawText: string }>;

export interface SatSectionPipelineInput {
  subject: string;
  /**
   * `null` = full test (extract both R&W and Math); `"rw"` or `"math"` =
   * section test (extract only that section).
   */
  sectionFilter: SatSection | null;
  effectiveAdaptiveMode: SatAdaptiveMode;
  userModuleCounts: Record<string, number> | null;
  systemInstruction: string;
  apiKey: string;
  pdfPart: Part;
  tracker: ReturnType<typeof createPhaseTracker> | null;
  /**
   * Optional Gemini extractor injection for tests. Defaults to the real
   * runSatGeminiExtraction which talks to the Gemini API.
   */
  extractor?: SatSectionExtractor;
}

export interface SatSectionPipelineResult {
  questions: SatGeminiExtractQuestion[];
  rawAggregate: string[];
  structureDetected: SatStructureDetected;
  modeMismatchWarning: string | null;
  detectedStructureSummary: string | undefined;
  bucketCountsDuringExtract: Record<string, number>;
  bucketCountsAfterFilter: Record<string, number>;
  auditWarnings: string[];
}

const SECTION_MAX_OUTPUT_TOKENS = 32768;

interface SectionExpectedCounts {
  m1?: number;
  m2?: number;
  m2Easy?: number;
  m2Hard?: number;
}

function expectedCountsForSection(
  section: SatSection,
  adaptiveMode: SatAdaptiveMode,
  userModuleCounts: Record<string, number> | null
): SectionExpectedCounts {
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

/**
 * Extract every question in a single SAT section with one Gemini call plus a
 * single retry when the first attempt returned zero. No per-module filtering
 * is done in the prompt; the caller splits into buckets locally.
 */
async function extractOneSection(
  section: SatSection,
  ctx: SatSectionPipelineInput,
  extractor: SatSectionExtractor
): Promise<{ questions: SatGeminiExtractQuestion[]; rawTexts: string[] }> {
  const rawTexts: string[] = [];
  const expected = expectedCountsForSection(
    section,
    ctx.effectiveAdaptiveMode,
    ctx.userModuleCounts
  );

  const runOnce = async (retry: boolean) => {
    const prompt = buildSatSectionExtractionPrompt(section, {
      adaptiveMode: ctx.effectiveAdaptiveMode,
      expectedCounts: expected,
      retry,
    });
    const result = await extractor({
      apiKey: ctx.apiKey,
      systemInstruction: ctx.systemInstruction,
      userPrompt: prompt,
      pdfPart: ctx.pdfPart,
      maxOutputTokens: SECTION_MAX_OUTPUT_TOKENS,
      temperature: retry ? 0.35 : 0.2,
    });
    rawTexts.push(result.rawText);
    return result.questions;
  };

  let questions = await runOnce(false);
  if (bucketExtractionNeedsRetry(questions.length)) {
    const retryQuestions = await runOnce(true);
    if (retryQuestions.length > questions.length) {
      questions = retryQuestions;
    }
  }

  return { questions, rawTexts };
}

function processBucketQuestions(
  bucketQuestions: SatGeminiExtractQuestion[],
  section: SatSection
): SatGeminiExtractQuestion[] {
  for (const q of bucketQuestions) {
    applySatIngestPostProcess(q, { section });
  }
  const { kept } = salvageFilterSatQuestions(bucketQuestions);
  return dropRowsWithoutSection(kept);
}

export async function runSatSectionExtractPipeline(
  ctx: SatSectionPipelineInput
): Promise<SatSectionPipelineResult> {
  const rawAggregate: string[] = [];
  const bucketCountsDuringExtract: Record<string, number> = {};
  const bucketCountsAfterFilter: Record<string, number> = {};
  const extractor: SatSectionExtractor = ctx.extractor ?? runSatGeminiExtraction;

  const sections: SatSection[] =
    ctx.sectionFilter == null ? ["rw", "math"] : [ctx.sectionFilter];

  const allQuestions: SatGeminiExtractQuestion[] = [];

  for (const section of sections) {
    const phaseId = sectionPhaseId(section);
    ctx.tracker?.start(phaseId);

    const { questions: sectionRaw, rawTexts } = await extractOneSection(
      section,
      ctx,
      extractor
    );
    for (const rt of rawTexts) {
      rawAggregate.push(
        `--- section:${section} (raw len=${rt.length}) ---\n${rt.slice(0, 2000)}`
      );
    }

    const buckets = splitSectionQuestionsIntoBuckets(
      sectionRaw,
      section,
      ctx.effectiveAdaptiveMode
    );

    let sectionKept = 0;
    for (const b of buckets) {
      const label = `${b.bucket.section}${b.bucket.module}${b.bucket.variant ?? ""}`;
      bucketCountsDuringExtract[label] = b.questions.length;
      const processed = processBucketQuestions(b.questions, section);
      bucketCountsAfterFilter[label] = processed.length;
      allQuestions.push(...processed);
      sectionKept += processed.length;

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[sat-extract-pipeline] section=${section} bucket=${label}: parsed=${b.questions.length} kept=${processed.length}`
        );
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[sat-extract-pipeline] section=${section} total parsed=${sectionRaw.length} kept=${sectionKept}`
      );
    }

    ctx.tracker?.done(
      phaseId,
      `${sectionKept} questions across ${buckets.length} module${
        buckets.length === 1 ? "" : "s"
      }`
    );
  }

  const questions = dedupeSatBucketQuestions(allQuestions);
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
  };
}

// Legacy names kept as aliases so existing tests / callers still compile.
export type SatBucketExtractor = SatSectionExtractor;
export type SatBucketPipelineInput = SatSectionPipelineInput;
export type SatBucketPipelineResult = SatSectionPipelineResult;
export const runSatBucketExtractPipeline = runSatSectionExtractPipeline;
