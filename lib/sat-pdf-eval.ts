import type { Part } from "@google/generative-ai";
import {
  isSatFullTest,
  isSatMath,
  isSatRw,
  isSatSectionTest,
  satSectionForSubject,
  type SatAdaptiveMode,
  type SatFormat,
  type SatSection,
} from "@/lib/exam-program";
import { getSystemPrompt, type SubjectKey } from "@/lib/gemini-prompts";
import {
  type SatGeminiExtractQuestion,
} from "@/lib/sat-gemini-extract";
import {
  runSatSectionExtractPipeline,
  type SatSectionExtractor,
  type SatSectionPipelineResult,
} from "@/lib/sat-extract-pipeline";
import { runSatApStyleExtraction } from "@/lib/sat-ap-style-extract";
import { buildSatSingleModuleUserPrompt } from "@/lib/sat-single-shot-pipeline";
import {
  buildSatModuleReport,
  reportCountForBucketKey,
  validateSatModuleReport,
  type SatModuleReport,
} from "@/lib/sat-extraction";
import {
  defaultSatModuleCounts,
  getSatUploadModuleFields,
  parseSatModuleQuestionCounts,
} from "@/lib/sat-upload-module-fields";

export interface EvalCliArgs {
  pdf: string;
  subject: string;
  format: SatFormat;
  adaptive: SatAdaptiveMode;
  mock: boolean;
  live: boolean;
  moduleCounts: Record<string, number> | null;
}

export interface EvalContext {
  subject: string;
  resolvedSatFormat: SatFormat;
  sectionFilter: SatSection | null;
  effectiveAdaptiveMode: SatAdaptiveMode;
  userModuleCounts: Record<string, number> | null;
  usesSectionPipeline: boolean;
}

export interface SuccessCriteria {
  description: string;
  minQuestions?: number;
  requireSection?: SatSection;
  requireFourOptions?: boolean;
  forbidErrorCodes?: Array<"MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH">;
  validateModuleReport?: boolean;
  countTolerance?: number;
}

export const SUCCESS_CRITERIA: Record<string, SuccessCriteria> = {
  "SAT_RW:single_module": {
    description: "R&W single practice sheet: ≥1 MCQ with content + 4 options, sat_section=rw",
    minQuestions: 1,
    requireSection: "rw",
    requireFourOptions: true,
    forbidErrorCodes: ["MODEL_EMPTY_ARRAY", "PDF_SECTION_MISMATCH"],
  },
  "SAT_MATH:single_module": {
    description: "Math single practice sheet: ≥1 question, sat_section=math",
    minQuestions: 1,
    requireSection: "math",
    forbidErrorCodes: ["MODEL_EMPTY_ARRAY", "PDF_SECTION_MISMATCH"],
  },
  "SAT_RW:section_test:none": {
    description: "R&W section test (non-adaptive): rw1 and rw2 buckets non-empty",
    validateModuleReport: true,
    forbidErrorCodes: ["MODEL_EMPTY_ARRAY", "PDF_SECTION_MISMATCH"],
  },
  "SAT_RW:section_test:six_module": {
    description: "R&W six-module: rw1/rw2Easy/rw2Hard within ±2 of user counts",
    validateModuleReport: true,
    countTolerance: 2,
    forbidErrorCodes: ["MODEL_EMPTY_ARRAY", "PDF_SECTION_MISMATCH"],
  },
  "SAT_FULL_TEST": {
    description: "Full test: rw + math sections extracted; PDF_SECTION_MISMATCH forbidden",
    minQuestions: 1,
    forbidErrorCodes: ["PDF_SECTION_MISMATCH"],
  },
};

export interface EvaluateOpts {
  subject: string;
  satFormat: SatFormat;
  effectiveAdaptiveMode: SatAdaptiveMode;
  sectionFilter: SatSection | null;
  userModuleCounts: Record<string, number> | null;
  mode: "mock" | "live";
}

export interface EvalOutput {
  ok: boolean;
  mode: "mock" | "live";
  phase: "extract" | "validate" | "done";
  errorCode?: string;
  subject: string;
  format: SatFormat;
  adaptive: SatAdaptiveMode;
  sectionFilter: SatSection | null;
  questionCount: number;
  moduleReport: SatModuleReport;
  emptyBucketKeys: string[];
  durationMs: number;
  hints: string[];
  error?: string;
}

export interface PipelineEvalInput {
  questions: SatGeminiExtractQuestion[];
  extractionErrorCode?: "MODEL_EMPTY_ARRAY" | "PDF_SECTION_MISMATCH";
  extractionError?: string;
}

const VALID_SUBJECTS = new Set([
  "SAT_RW",
  "SAT_MATH",
  "SAT_FULL_TEST",
]);

const VALID_FORMATS = new Set<SatFormat>([
  "single_module",
  "section_test",
  "full_test",
]);

const VALID_ADAPTIVE = new Set<SatAdaptiveMode>(["none", "six_module"]);

function criteriaKey(
  subject: string,
  format: SatFormat,
  adaptive: SatAdaptiveMode
): string {
  if (subject === "SAT_FULL_TEST") return "SAT_FULL_TEST";
  if (format === "single_module") return `${subject}:single_module`;
  return `${subject}:${format}:${adaptive}`;
}

function sanitizeModuleCounts(
  subject: string,
  counts: Record<string, number> | null
): Record<string, number> | null {
  if (!counts) return null;
  const out = { ...counts };
  if (isSatRw(subject)) {
    for (const k of Object.keys(out)) {
      if (k.startsWith("math")) delete out[k];
    }
  } else if (isSatMath(subject)) {
    for (const k of Object.keys(out)) {
      if (k.startsWith("rw")) delete out[k];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseEvalCliArgs(argv: string[]): EvalCliArgs {
  let pdf = "";
  let subject = "SAT_RW";
  let format: SatFormat = "single_module";
  let adaptive: SatAdaptiveMode = "none";
  let mock = false;
  let live = false;
  let moduleCounts: Record<string, number> | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pdf" && argv[i + 1]) {
      pdf = argv[++i];
    } else if (arg === "--subject" && argv[i + 1]) {
      subject = argv[++i];
    } else if (arg === "--format" && argv[i + 1]) {
      format = argv[++i] as SatFormat;
    } else if (arg === "--adaptive" && argv[i + 1]) {
      adaptive = argv[++i] as SatAdaptiveMode;
    } else if (arg === "--module-counts" && argv[i + 1]) {
      try {
        moduleCounts = JSON.parse(argv[++i]) as Record<string, number>;
      } catch {
        throw new Error("--module-counts must be valid JSON");
      }
    } else if (arg === "--mock") {
      mock = true;
    } else if (arg === "--live") {
      live = true;
    }
  }

  if (!pdf) {
    throw new Error("--pdf is required");
  }
  if (!VALID_SUBJECTS.has(subject)) {
    throw new Error(`Invalid --subject: ${subject}`);
  }
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Invalid --format: ${format}`);
  }
  if (!VALID_ADAPTIVE.has(adaptive)) {
    throw new Error(`Invalid --adaptive: ${adaptive}`);
  }
  if (mock && live) {
    throw new Error("Use only one of --mock or --live");
  }

  return { pdf, subject, format, adaptive, mock: mock || !live, live, moduleCounts };
}

export function buildEvalContext(args: EvalCliArgs): EvalContext {
  const resolvedSatFormat: SatFormat =
    args.format ?? (isSatFullTest(args.subject) ? "full_test" : "single_module");
  const sectionFilter = satSectionForSubject(args.subject);
  const effectiveAdaptiveMode = args.adaptive ?? "none";
  const usesSectionPipeline =
    isSatFullTest(args.subject) ||
    isSatSectionTest(args.subject, resolvedSatFormat);

  const fields = getSatUploadModuleFields({
    subject: args.subject,
    satFormat: resolvedSatFormat,
    satAdaptiveMode: effectiveAdaptiveMode,
  });
  const parsed =
    args.moduleCounts &&
    parseSatModuleQuestionCounts(args.moduleCounts, fields);
  const userModuleCounts = sanitizeModuleCounts(
    args.subject,
    parsed ?? (args.moduleCounts ? args.moduleCounts : defaultSatModuleCounts(fields))
  );

  return {
    subject: args.subject,
    resolvedSatFormat,
    sectionFilter,
    effectiveAdaptiveMode,
    userModuleCounts,
    usesSectionPipeline,
  };
}

function makeMockQuestion(
  section: SatSection,
  module: 1 | 2,
  index: number,
  variant: "easy" | "hard" | null = null
): SatGeminiExtractQuestion {
  const stem = `Mock ${section} M${module} question ${index + 1} with enough text for salvage filter.`;
  return {
    type: "text",
    content: stem,
    image_description: section === "rw" ? "Mock passage excerpt." : null,
    options: ["Alpha choice", "Beta choice", "Gamma choice", "Delta choice"],
    question_type: "mcq",
    correct: "A",
    accepted_answers: null,
    sat_section: section,
    sat_module: module,
    sat_module_variant: variant,
    sat_difficulty: null,
  };
}

function countForBucket(
  ctx: EvalContext,
  key: string,
  fallback: number
): number {
  const n = ctx.userModuleCounts?.[key];
  return typeof n === "number" && n > 0 ? n : fallback;
}

function generateSectionBatch(
  ctx: EvalContext,
  section: SatSection
): SatGeminiExtractQuestion[] {
  const questions: SatGeminiExtractQuestion[] = [];
  if (ctx.effectiveAdaptiveMode === "six_module") {
    const m1 = countForBucket(
      ctx,
      section === "rw" ? "rw1" : "math1",
      section === "rw" ? 27 : 22
    );
    const m2e = countForBucket(
      ctx,
      section === "rw" ? "rw2easy" : "math2easy",
      14
    );
    const m2h = countForBucket(
      ctx,
      section === "rw" ? "rw2hard" : "math2hard",
      14
    );
    for (let i = 0; i < Math.min(m1, 35); i++) {
      questions.push(makeMockQuestion(section, 1, i));
    }
    for (let i = 0; i < Math.min(m2e, 35); i++) {
      questions.push(makeMockQuestion(section, 2, i, "easy"));
    }
    for (let i = 0; i < Math.min(m2h, 35); i++) {
      questions.push(makeMockQuestion(section, 2, i, "hard"));
    }
    return questions;
  }

  const m1 = countForBucket(
    ctx,
    section === "rw" ? "rw1" : "math1",
    section === "rw" ? 27 : 22
  );
  const m2 = countForBucket(
    ctx,
    section === "rw" ? "rw2" : "math2",
    section === "rw" ? 27 : 22
  );
  for (let i = 0; i < Math.min(m1, 35); i++) {
    questions.push(makeMockQuestion(section, 1, i));
  }
  for (let i = 0; i < Math.min(m2, 35); i++) {
    questions.push(makeMockQuestion(section, 2, i));
  }
  return questions;
}

function generateModuleBatch(
  ctx: EvalContext,
  section: SatSection,
  module: 1 | 2,
  variant: "easy" | "hard" | null
): SatGeminiExtractQuestion[] {
  let key = "";
  if (section === "rw" && module === 1) key = "rw1";
  else if (section === "rw" && module === 2 && variant === "easy") key = "rw2easy";
  else if (section === "rw" && module === 2 && variant === "hard") key = "rw2hard";
  else if (section === "rw" && module === 2) key = "rw2";
  else if (section === "math" && module === 1) key = "math1";
  else if (section === "math" && module === 2 && variant === "easy") key = "math2easy";
  else if (section === "math" && module === 2 && variant === "hard") key = "math2hard";
  else if (section === "math" && module === 2) key = "math2";

  const count = countForBucket(ctx, key, module === 1 ? 27 : 14);
  const n = Math.min(count, 35);
  return Array.from({ length: n }, (_, i) =>
    makeMockQuestion(section, module, i, variant)
  );
}

function detectSectionFromPrompt(prompt: string): SatSection {
  const lower = prompt.toLowerCase();
  if (lower.includes("math") && !lower.includes("reading & writing")) {
    return "math";
  }
  return "rw";
}

function isModuleLevelPrompt(prompt: string): boolean {
  return (
    /FIRST module only/i.test(prompt) ||
    /SECOND module only/i.test(prompt) ||
    /SECOND-STAGE EASY path ONLY/i.test(prompt) ||
    /SECOND-STAGE HARD path ONLY/i.test(prompt)
  );
}

/** Synthetic extractor for mock eval — independent of PDF bytes. */
export function createMockSatExtractor(ctx: EvalContext): SatSectionExtractor {
  return async (args) => {
    const prompt = args.userPrompt;
    const section = detectSectionFromPrompt(prompt);

    if (isModuleLevelPrompt(prompt)) {
      let module: 1 | 2 = 1;
      let variant: "easy" | "hard" | null = null;
      if (/SECOND module only/i.test(prompt) || /SECOND-STAGE/i.test(prompt)) {
        module = 2;
      }
      if (/EASY path ONLY/i.test(prompt)) variant = "easy";
      if (/HARD path ONLY/i.test(prompt)) variant = "hard";
      const questions = generateModuleBatch(ctx, section, module, variant);
      return { questions, rawText: JSON.stringify(questions) };
    }

    if (ctx.resolvedSatFormat === "single_module" || !ctx.usesSectionPipeline) {
      const key = section === "rw" ? "rw1" : "math1";
      const count = countForBucket(ctx, key, section === "rw" ? 27 : 22);
      const n = Math.min(count, 8);
      const questions = Array.from({ length: n }, (_, i) =>
        makeMockQuestion(section, 1, i)
      );
      return { questions, rawText: JSON.stringify(questions) };
    }

    const questions = generateSectionBatch(ctx, section);
    return { questions, rawText: JSON.stringify(questions) };
  };
}

function buildHints(
  errorCode: string | undefined,
  emptyBucketKeys: string[],
  subject: string,
  format: SatFormat
): string[] {
  const hints: string[] = [];
  if (errorCode === "MODEL_EMPTY_ARRAY") {
    hints.push("Try Single practice sheet format");
    hints.push("PDF may be scanned images only");
    hints.push("Confirm subject matches PDF section (R&W vs Math)");
  }
  if (errorCode === "PDF_SECTION_MISMATCH") {
    hints.push("PDF section does not match selected subject");
    if (subject === "SAT_MATH") hints.push("Use SAT_RW for R&W-only PDFs");
    if (subject === "SAT_RW") hints.push("Use SAT_MATH for Math-only PDFs");
  }
  if (emptyBucketKeys.length > 0) {
    hints.push(`Empty buckets: ${emptyBucketKeys.join(", ")}`);
    if (format === "section_test") {
      hints.push("Try section_test with correct adaptive mode (none vs six_module)");
    }
  }
  return hints;
}

function checkCountTolerance(
  report: SatModuleReport,
  userCounts: Record<string, number>,
  tolerance: number
): { ok: boolean; emptyBucketKeys: string[]; error?: string } {
  const emptyBucketKeys: string[] = [];
  for (const [key, expected] of Object.entries(userCounts)) {
    if (expected <= 0) continue;
    const actual = reportCountForBucketKey(report, key);
    if (actual === 0) {
      emptyBucketKeys.push(key);
      continue;
    }
    if (Math.abs(actual - expected) > tolerance) {
      return {
        ok: false,
        emptyBucketKeys,
        error: `Bucket ${key}: expected ~${expected} (±${tolerance}), got ${actual}`,
      };
    }
  }
  if (emptyBucketKeys.length > 0) {
    return { ok: false, emptyBucketKeys, error: `Empty buckets: ${emptyBucketKeys.join(", ")}` };
  }
  return { ok: true, emptyBucketKeys };
}

export function evaluatePipelineResult(
  input: PipelineEvalInput,
  opts: EvaluateOpts,
  durationMs: number
): EvalOutput {
  const { questions, extractionErrorCode, extractionError } = input;
  const moduleReport = buildSatModuleReport(questions);
  const key = criteriaKey(
    opts.subject,
    opts.satFormat,
    opts.effectiveAdaptiveMode
  );
  const criteria = SUCCESS_CRITERIA[key] ?? SUCCESS_CRITERIA["SAT_FULL_TEST"];

  const base: EvalOutput = {
    ok: false,
    mode: opts.mode,
    phase: "extract",
    subject: opts.subject,
    format: opts.satFormat,
    adaptive: opts.effectiveAdaptiveMode,
    sectionFilter: opts.sectionFilter,
    questionCount: questions.length,
    moduleReport,
    emptyBucketKeys: [],
    durationMs,
    hints: [],
  };

  if (extractionErrorCode) {
    if (criteria.forbidErrorCodes?.includes(extractionErrorCode)) {
      return {
        ...base,
        errorCode: extractionErrorCode,
        error: extractionError,
        hints: buildHints(
          extractionErrorCode,
          [],
          opts.subject,
          opts.satFormat
        ),
      };
    }
  }

  if (criteria.forbidErrorCodes?.includes("MODEL_EMPTY_ARRAY") && questions.length === 0) {
    return {
      ...base,
      errorCode: extractionErrorCode ?? "MODEL_EMPTY_ARRAY",
      error: extractionError ?? "No questions extracted",
      hints: buildHints("MODEL_EMPTY_ARRAY", [], opts.subject, opts.satFormat),
    };
  }

  if ((criteria.minQuestions ?? 1) > questions.length) {
    return {
      ...base,
      phase: "validate",
      errorCode: extractionErrorCode ?? "INSUFFICIENT_QUESTIONS",
      error: `Expected at least ${criteria.minQuestions ?? 1} questions, got ${questions.length}`,
      hints: buildHints(extractionErrorCode, [], opts.subject, opts.satFormat),
    };
  }

  if (criteria.requireSection) {
    const wrong = questions.filter((q) => q.sat_section !== criteria.requireSection);
    if (wrong.length > 0) {
      return {
        ...base,
        phase: "validate",
        errorCode: "WRONG_SECTION",
        error: `${wrong.length} questions have wrong sat_section (expected ${criteria.requireSection})`,
        hints: ["Confirm subject and format match the PDF"],
      };
    }
  }

  if (criteria.requireFourOptions) {
    const bad = questions.filter(
      (q) => !Array.isArray(q.options) || q.options.length < 4
    );
    if (bad.length > 0) {
      return {
        ...base,
        phase: "validate",
        errorCode: "INVALID_OPTIONS",
        error: `${bad.length} questions missing 4 options`,
      };
    }
  }

  if (criteria.validateModuleReport) {
    if (criteria.countTolerance != null && opts.userModuleCounts) {
      const tol = checkCountTolerance(
        moduleReport,
        opts.userModuleCounts,
        criteria.countTolerance
      );
      if (!tol.ok) {
        return {
          ...base,
          phase: "validate",
          errorCode: "MODULE_COUNT_MISMATCH",
          error: tol.error,
          emptyBucketKeys: tol.emptyBucketKeys,
          hints: buildHints(undefined, tol.emptyBucketKeys, opts.subject, opts.satFormat),
        };
      }
    } else {
      const validation = validateSatModuleReport(
        moduleReport,
        opts.effectiveAdaptiveMode,
        null,
        opts.sectionFilter,
        opts.userModuleCounts ? { userModuleCounts: opts.userModuleCounts } : undefined
      );
      if (!validation.ok) {
        return {
          ...base,
          phase: "validate",
          errorCode: "MODULE_REPORT_INVALID",
          error: validation.error,
          emptyBucketKeys: validation.emptyBucketKeys ?? [],
          hints: buildHints(
            undefined,
            validation.emptyBucketKeys ?? [],
            opts.subject,
            opts.satFormat
          ),
        };
      }
    }
  }

  if (opts.subject === "SAT_FULL_TEST") {
    const hasRw = moduleReport.rw1 > 0 || moduleReport.rw2 > 0;
    const hasMath = moduleReport.math1 > 0 || moduleReport.math2 > 0;
    if (!hasRw || !hasMath) {
      return {
        ...base,
        phase: "validate",
        errorCode: "INCOMPLETE_FULL_TEST",
        error: `Full test needs rw and math sections (rw=${hasRw}, math=${hasMath})`,
        emptyBucketKeys: [
          ...(!hasRw ? ["rw1"] : []),
          ...(!hasMath ? ["math1"] : []),
        ],
        hints: ["Upload a complete SAT full test PDF or use section upload"],
      };
    }
  }

  return {
    ...base,
    ok: true,
    phase: "done",
    hints: [],
  };
}


export interface RunEvalOptions {
  ctx: EvalContext;
  pdfPart: Part;
  apiKey: string;
  mode: "mock" | "live";
}

export async function runEvalExtraction(
  opts: RunEvalOptions
): Promise<PipelineEvalInput> {
  const { ctx, pdfPart, apiKey, mode } = opts;
  const extractor =
    mode === "mock" ? createMockSatExtractor(ctx) : undefined;

  const systemInstruction = getSystemPrompt(ctx.subject as SubjectKey, true, {
    satAdaptiveMode: ctx.effectiveAdaptiveMode,
    satFormat: ctx.resolvedSatFormat,
  });

  if (ctx.usesSectionPipeline) {
    const result: SatSectionPipelineResult = await runSatSectionExtractPipeline({
      subject: ctx.subject,
      satFormat: ctx.resolvedSatFormat,
      sectionFilter: ctx.sectionFilter,
      effectiveAdaptiveMode: ctx.effectiveAdaptiveMode,
      userModuleCounts: ctx.userModuleCounts,
      systemInstruction,
      apiKey,
      pdfPart,
      tracker: null,
      extractor,
    });
    return {
      questions: result.questions,
      extractionErrorCode: result.extractionErrorCode,
      extractionError: result.extractionError,
    };
  }

  const userPrompt = buildSatSingleModuleUserPrompt({
    subject: ctx.subject,
    userModuleCounts: ctx.userModuleCounts,
    questionCount: 27,
  });
  const extractFn = extractor ?? runSatApStyleExtraction;
  const result = await extractFn({
    apiKey,
    systemInstruction,
    userPrompt,
    pdfPart,
    maxOutputTokens: 32768,
  });

  let extractionErrorCode: PipelineEvalInput["extractionErrorCode"];
  let extractionError: string | undefined;
  if (result.questions.length === 0) {
    extractionErrorCode = "MODEL_EMPTY_ARRAY";
    extractionError = "AI returned no questions from PDF";
  }

  return {
    questions: result.questions,
    extractionErrorCode,
    extractionError,
  };
}
