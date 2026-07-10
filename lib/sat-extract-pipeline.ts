import type { Part } from "@google/generative-ai";
import type { SatAdaptiveMode, SatSection } from "@/lib/exam-program";
import { dedupeSatBucketQuestions } from "@/lib/sat-bucket-dedupe";
import { applySatIngestPostProcess } from "@/lib/sat-ingest-postprocess";
import { applyBucketToQuestion, bucketKey } from "@/lib/sat-module-normalizer";
import type { SatModuleBucket } from "@/lib/sat-module-normalizer";
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
  buildSatBucketExtractionPrompt,
  buildSatExtractionPlan,
  type SatStructureDetected,
} from "@/lib/sat-extraction";
import {
  bucketPhaseId,
  type createPhaseTracker,
} from "@/lib/upload-analyze-progress";

export type SatBucketExtractor = (args: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  pdfPart: Part;
  maxOutputTokens?: number;
  temperature?: number;
}) => Promise<{ questions: SatGeminiExtractQuestion[]; rawText: string }>;

export interface SatBucketPipelineInput {
  subject: string;
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
  extractor?: SatBucketExtractor;
}

export interface SatBucketPipelineResult {
  questions: SatGeminiExtractQuestion[];
  rawAggregate: string[];
  structureDetected: SatStructureDetected;
  modeMismatchWarning: string | null;
  detectedStructureSummary: string | undefined;
  bucketCountsDuringExtract: Record<string, number>;
  bucketCountsAfterFilter: Record<string, number>;
  auditWarnings: string[];
}

/**
 * Extract a single bucket with one Gemini call plus a single retry if the
 * first attempt returned zero questions. No split-batching, no gap-fill —
 * user-entered target counts are the source of truth for expected size.
 */
async function extractSingleBucket(
  bucket: SatModuleBucket,
  ctx: SatBucketPipelineInput,
  extractor: SatBucketExtractor
): Promise<{ questions: SatGeminiExtractQuestion[]; rawTexts: string[] }> {
  const rawTexts: string[] = [];

  const runOnce = async (retry: boolean) => {
    const prompt = buildSatBucketExtractionPrompt(bucket, {
      adaptiveMode: ctx.effectiveAdaptiveMode,
      retry,
    });
    const result = await extractor({
      apiKey: ctx.apiKey,
      systemInstruction: ctx.systemInstruction,
      userPrompt: prompt,
      pdfPart: ctx.pdfPart,
      maxOutputTokens: 8192,
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

  const tagged = questions.map((q) => applyBucketToQuestion(q, bucket));
  const deduped = dedupeSatBucketQuestions(tagged);
  return { questions: deduped, rawTexts };
}

function processBucketQuestions(
  bucketQuestions: SatGeminiExtractQuestion[],
  bucket: SatModuleBucket
): SatGeminiExtractQuestion[] {
  for (const q of bucketQuestions) {
    applySatIngestPostProcess(q, { section: bucket.section });
  }
  const { kept } = salvageFilterSatQuestions(bucketQuestions);
  return dropRowsWithoutSection(kept);
}

export async function runSatBucketExtractPipeline(
  ctx: SatBucketPipelineInput
): Promise<SatBucketPipelineResult> {
  const rawAggregate: string[] = [];
  const bucketCountsDuringExtract: Record<string, number> = {};
  const bucketCountsAfterFilter: Record<string, number> = {};
  const extractor: SatBucketExtractor = ctx.extractor ?? runSatGeminiExtraction;

  const plan = buildSatExtractionPlan(
    ctx.effectiveAdaptiveMode,
    ctx.sectionFilter,
    ctx.userModuleCounts
  );

  const allQuestions: SatGeminiExtractQuestion[] = [];

  for (const bucket of plan) {
    const phaseId = bucketPhaseId(bucket);
    const bucketLabel = bucketKey(bucket);
    ctx.tracker?.start(phaseId);

    const { questions: extracted, rawTexts } = await extractSingleBucket(
      bucket,
      ctx,
      extractor
    );
    for (const rt of rawTexts) {
      rawAggregate.push(
        `--- ${bucketLabel} (raw len=${rt.length}) ---\n${rt.slice(0, 2000)}`
      );
    }
    bucketCountsDuringExtract[bucketLabel] = extracted.length;

    const processed = processBucketQuestions(extracted, bucket);
    bucketCountsAfterFilter[bucketLabel] = processed.length;

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[sat-extract-pipeline] bucket ${bucketLabel}: parsed ${bucketCountsDuringExtract[bucketLabel]} -> after filter ${processed.length}`
      );
    }

    allQuestions.push(...processed);
    ctx.tracker?.done(phaseId, `${processed.length} questions`);
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
