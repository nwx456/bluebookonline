import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { countRowsWithPdfAnswerKey } from "@/lib/answer-key-label";
import { getSystemPrompt, isCodeSubject, SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { buildPdfPart } from "@/lib/gemini-client";
import { partitionStemAndSharedIntro } from "@/lib/shared-stimulus";
import {
  GEMINI_INLINE_LIMIT_BYTES,
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";
import {
  getExamProgram,
  isSatFullTest,
  isSatSectionTest,
  satSectionForSubject,
  type SatAdaptiveMode,
  type SatFormat,
} from "@/lib/exam-program";
import {
  applySatIngestPostProcess,
  partitionSatStemAndPassage,
} from "@/lib/sat-ingest-postprocess";
import { runSatSectionExtractPipeline } from "@/lib/sat-extract-pipeline";
import { runSatGeminiExtraction } from "@/lib/sat-gemini-extract";
import {
  dropRowsWithoutSection,
  salvageFilterSatQuestions,
} from "@/lib/sat-question-filter";
import {
  buildSatModuleReport,
  formatSatModuleReport,
  formatTurkishModuleCountWarning,
  reportCountForBucketKey,
  reportToLegacyModuleCounts,
  validateSatModuleReport,
} from "@/lib/sat-extraction";
import {
  getSatUploadModuleFields,
  parseSatModuleQuestionCounts,
  sumModuleCounts,
} from "@/lib/sat-upload-module-fields";
import { handleApAnalyze } from "@/lib/ap-analyze";
import {
  buildClientAnalyzePhases,
  createPhaseTracker,
  formatFriendlyAnalyzeError,
  PHASE_EXTRACT,
  PHASE_SAVE,
  PHASE_VALIDATE,
  type ProgressEvent,
} from "@/lib/upload-analyze-progress";

export const maxDuration = 300;

const MAX_FILE_BYTES = MAX_PDF_UPLOAD_BYTES;
const UPLOADS_BUCKET = "pdf_uploads";

interface AnalyzeInput {
  buffer: Buffer;
  filename: string;
  subject: string;
  questionCount: number | null;
  hasVisuals: boolean;
  aiProvider: "gemini" | "claude";
  userEmail: string;
  satFormat: SatFormat | null;
  satAdaptiveMode: SatAdaptiveMode | null;
  satCutoffRw: number | null;
  satCutoffMath: number | null;
  satModuleQuestionCounts: Record<string, number> | null;
  /** Already-uploaded storage path the file was downloaded from, when present. */
  prefetchedStoragePath: string | null;
  streamProgress?: boolean;
}

class AnalyzeFailError extends Error {
  constructor(
    public status: number,
    public payload: Record<string, unknown>,
    public failedPhaseId?: string
  ) {
    super(String(payload.error ?? "Analysis failed"));
    this.name = "AnalyzeFailError";
  }
}

export interface AnalyzeSuccessResult {
  examId: string;
  questionCount: number;
  moduleCounts?: ReturnType<typeof reportToLegacyModuleCounts>;
  moduleReport?: ReturnType<typeof buildSatModuleReport>;
  moduleCountWarning?: string;
  moduleSummary?: string;
}

function throwFail(
  status: number,
  payload: Record<string, unknown>,
  failedPhaseId?: string
): never {
  throw new AnalyzeFailError(status, payload, failedPhaseId);
}

function parseProvider(value: string | null | undefined): "gemini" | "claude" {
  return value?.trim() === "claude" ? "claude" : "gemini";
}

function parseSatAdaptiveMode(value: string | null | undefined): SatAdaptiveMode | null {
  const v = value?.trim();
  if (v === "pool") return "none";
  return v === "none" || v === "six_module" ? (v as SatAdaptiveMode) : null;
}

function parseSatFormat(value: string | null | undefined): SatFormat | null {
  const v = value?.trim();
  if (v === "full_test") return "full_test";
  if (v === "section_test") return "section_test";
  if (v === "single_module") return "single_module";
  return null;
}

function parseIntOrNull(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

async function readJsonStorageInput(request: NextRequest): Promise<AnalyzeInput | NextResponse> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }
  if (!filename) {
    return NextResponse.json({ error: "filename is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .download(storagePath);

  if (downloadError || !downloaded) {
    console.error("storage download error:", downloadError);
    return NextResponse.json(
      { error: "Could not download the uploaded PDF. Try uploading again." },
      { status: 502 }
    );
  }

  const arrayBuffer = await downloaded.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json(
      { error: "Uploaded file is empty." },
      { status: 400 }
    );
  }
  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `PDF must be at most ${MAX_PDF_UPLOAD_MB} MB. Try compressing the file or removing extra pages to reduce the size.`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(arrayBuffer);

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const satFormat = parseSatFormat(typeof body.satFormat === "string" ? body.satFormat : null);
  const satAdaptiveMode = parseSatAdaptiveMode(
    typeof body.satAdaptiveMode === "string" ? body.satAdaptiveMode : null
  );
  const resolvedSatFormat: SatFormat =
    satFormat ?? (isSatFullTest(subject) ? "full_test" : "single_module");
  const moduleFields = getSatUploadModuleFields({
    subject,
    satFormat: resolvedSatFormat,
    satAdaptiveMode: satAdaptiveMode ?? "none",
  });
  const satModuleQuestionCounts =
    body.satModuleQuestionCounts != null
      ? parseSatModuleQuestionCounts(body.satModuleQuestionCounts, moduleFields)
      : null;

  return {
    buffer,
    filename,
    subject,
    questionCount:
      typeof body.questionCount === "number"
        ? body.questionCount
        : parseIntOrNull(typeof body.questionCount === "string" ? body.questionCount : null),
    hasVisuals: body.hasVisuals === true || body.hasVisuals === "true",
    aiProvider: parseProvider(typeof body.aiProvider === "string" ? body.aiProvider : null),
    userEmail: typeof body.userEmail === "string" ? body.userEmail.trim() : "",
    satFormat,
    satAdaptiveMode,
    satCutoffRw:
      typeof body.satCutoffRw === "number"
        ? body.satCutoffRw
        : parseIntOrNull(typeof body.satCutoffRw === "string" ? body.satCutoffRw : null),
    satCutoffMath:
      typeof body.satCutoffMath === "number"
        ? body.satCutoffMath
        : parseIntOrNull(typeof body.satCutoffMath === "string" ? body.satCutoffMath : null),
    satModuleQuestionCounts,
    prefetchedStoragePath: storagePath,
    streamProgress: body.streamProgress === true,
  };
}

/** Expected shape of one question from Gemini (matches lib/gemini-prompts.ts OUTPUT_SCHEMA) */
interface GeminiQuestion {
  type?: "code" | "image" | "text";
  content?: string;
  code?: string;
  question?: string;
  precondition?: string;
  image_description?: string | null;
  has_graph?: boolean;
  page_number?: number | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  options?: string[];
  correct?: string | null;
  // SAT-specific
  sat_section?: "rw" | "math" | null;
  sat_module?: 1 | 2 | null;
  sat_module_variant?: "easy" | "hard" | null;
  sat_difficulty?: "easy" | "medium" | "hard" | null;
  question_type?: "mcq" | "grid_in" | null;
  accepted_answers?: string[] | null;
  sat_pdf_module_label?: string | null;
  pdf_module_label?: string | null;
}

/** Parse and validate bbox (0-1 normalized). Returns null if invalid. */
function parseBbox(bbox: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!bbox || typeof bbox !== "object") return null;
  const o = bbox as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (
    !Number.isFinite(x) || !Number.isFinite(y) ||
    !Number.isFinite(width) || !Number.isFinite(height) ||
    x < 0 || x > 1 || y < 0 || y > 1 ||
    width <= 0 || width > 1 || height <= 0 || height > 1 ||
    x + width > 1 || y + height > 1
  ) {
    return null;
  }
  return { x, y, width, height };
}

function parseJsonFromResponse(raw: string): GeminiQuestion[] {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as GeminiQuestion[];
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice) as unknown;
        if (Array.isArray(parsed)) return parsed as GeminiQuestion[];
      } catch {
        // fallback failed
      }
    }
    return [];
  }
}

function normalizeCorrect(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).toUpperCase().trim();
  if (["A", "B", "C", "D", "E"].includes(s)) return s;
  return null;
}

/** For SAT grid-in questions, correct can be a numeric string like "3/2" or "0.5". */
function normalizeCorrectSat(value: unknown, questionType: "mcq" | "grid_in"): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (questionType === "mcq") {
    const upper = raw.toUpperCase();
    return ["A", "B", "C", "D"].includes(upper) ? upper : null;
  }
  // grid_in: accept numeric / fraction string
  if (/^-?[\d./]+$/.test(raw) && /\d/.test(raw)) return raw;
  return null;
}

function normalizeSatSection(value: unknown): "rw" | "math" | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  return v === "rw" || v === "math" ? v : null;
}

function normalizeSatModule(value: unknown): 1 | 2 | null {
  if (value === 1 || value === 2) return value;
  const n = Number(value);
  return n === 1 || n === 2 ? (n as 1 | 2) : null;
}

function normalizeSatVariant(value: unknown): "easy" | "hard" | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  return v === "easy" || v === "hard" ? v : null;
}

function normalizeSatDifficulty(value: unknown): "easy" | "medium" | "hard" | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  return v === "easy" || v === "medium" || v === "hard" ? v : null;
}

function normalizeQuestionType(value: unknown): "mcq" | "grid_in" {
  if (typeof value !== "string") return "mcq";
  const v = value.toLowerCase().trim();
  return v === "grid_in" || v === "grid-in" || v === "gridin" ? "grid_in" : "mcq";
}

function normalizeAcceptedAnswers(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const arr = value
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter((s) => s.length > 0);
  return arr.length > 0 ? arr : null;
}

function optionsToColumns(options: unknown, satOnlyAD = false): {
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
} {
  const arr = Array.isArray(options) ? options : [];
  const strings = arr.map((o) => (o != null ? String(o).trim() : ""));
  return {
    option_a: strings[0] || null,
    option_b: strings[1] || null,
    option_c: strings[2] || null,
    option_d: strings[3] || null,
    option_e: satOnlyAD ? null : strings[4] || null,
  };
}

/** CSA: Strip trailing question sentence from code so only reference code remains in passage_text. */
function stripQuestionFromCode(code: string | null | undefined): {
  codeOnly: string | null;
  strippedQuestion: string | null;
} {
  if (!code?.trim()) return { codeOnly: code?.trim() || null, strippedQuestion: null };
  const t = code.trim();
  // Match trailing question: line(s) that look like "Which...?", "What...?", or any sentence ending with ?
  const questionPattern = /\n?\s*(Which\s+.+\?|What\s+(?:is|does|will|would)\s+.+\?|\.\s+\d+\.\s+.+\?)(\s*)$/is;
  const match = t.match(questionPattern);
  if (match) {
    const idx = t.indexOf(match[1]);
    const codeOnly = t.slice(0, idx).trim();
    const strippedQuestion = match[1].trim();
    return { codeOnly: codeOnly || null, strippedQuestion: strippedQuestion || null };
  }
  // Fallback: last line ending with ? (sentence that shouldn't be in code)
  const lastLineQ = /\n([^\n]*\?)\s*$/;
  const m2 = t.match(lastLineQ);
  if (m2) {
    const idx = t.lastIndexOf(m2[1]);
    const codeOnly = t.slice(0, idx).trim();
    return { codeOnly: codeOnly || null, strippedQuestion: m2[1].trim() };
  }
  return { codeOnly: t, strippedQuestion: null };
}

/** Treat known placeholder or trivial text as empty so it is not shown as question/passage. */
function isPlaceholderText(text: string | null | undefined): boolean {
  if (text == null) return true;
  const t = text.trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
  if (t === "geriye dönük uyumluluk için") return true;
  return false;
}

/** For Economics/Stats/Psych: strip numbered list block (I. II. III. ...) from questionText so only stem remains. */
function stripReferenceListFromStem(questionText: string, passageText: string | null): string {
  const q = questionText.trim();
  if (!q) return q;
  if (!passageText?.trim()) return q;
  // Match stem (up to and including "?") followed by optional whitespace and "I." starting the list
  const match = q.match(/^([\s\S]*?\?)\s*(?:\r?\n[\s\S]*?)?\s*I\.\s+[\s\S]*$/);
  if (match) {
    const stripped = match[1].trim();
    if (stripped.length >= 30) return stripped;
  }
  return q;
}

/** True if text looks like a question stem only; should not go to left panel. */
function looksLikeQuestionStemOnly(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (t.includes("<table") || t.includes("<svg") || /^\|/.test(t)) return false;
  // I. II. III. öncül listesi ise stem değildir
  if (/\n\s*I[I]?\.\s/m.test(t) || /^\s*I\.\s/m.test(t)) return false;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const listLike = lines.filter((l) => /^\s*[IVX]+\.\s/.test(l) || /^\s*\d+\.\s/.test(l));
  if (listLike.length >= 2 || (lines.length >= 2 && listLike.length >= 1)) return false;
  return lines.length <= 3 && t.length < 600 && (t.endsWith("?") || /^(Which|What|How)\s/i.test(t));
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return handleApAnalyze(request);
    }

    const inputOrResp = await readJsonStorageInput(request);
    if (inputOrResp instanceof NextResponse) return inputOrResp;
    const input = inputOrResp;

    const {
      buffer,
      filename,
      subject: subjectRaw,
      questionCount: questionCountRaw,
      hasVisuals,
      aiProvider,
      userEmail,
      satFormat,
      satAdaptiveMode,
      satCutoffRw,
      satCutoffMath,
      prefetchedStoragePath,
    } = input;

    if (aiProvider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey?.trim()) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY is not set. Add it to .env for PDF analysis." },
          { status: 500 }
        );
      }
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey?.trim()) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not set. Add it to .env to use Claude for PDF analysis." },
          { status: 500 }
        );
      }
    }

    const subject = subjectRaw?.trim();
    if (!subject || !SUBJECT_KEYS.includes(subject as SubjectKey)) {
      return NextResponse.json(
        { error: "Invalid or missing subject." },
        { status: 400 }
      );
    }

    if (getExamProgram(subject as SubjectKey) !== "SAT") {
      return NextResponse.json(
        { error: "AP uploads must use multipart FormData." },
        { status: 400 }
      );
    }

    const isSatFull = isSatFullTest(subject);
    const resolvedSatFormat: SatFormat =
      satFormat ?? (isSatFull ? "full_test" : "single_module");
    const usesSectionPipeline =
      isSatFull || isSatSectionTest(subject, resolvedSatFormat);

    // Full test and section_test use section extraction; question count is optional.
    const questionCount = usesSectionPipeline
      ? (questionCountRaw != null && Number.isInteger(questionCountRaw) && questionCountRaw > 0
          ? questionCountRaw
          : 100)
      : questionCountRaw;
    if (!usesSectionPipeline && (questionCount == null || !Number.isInteger(questionCount) || questionCount < 1)) {
      return NextResponse.json(
        { error: "Question count must be a positive number." },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: userRow, error: userCheckError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (userCheckError || !userRow) {
      return NextResponse.json(
        {
          error:
            "Account not fully set up. Please sign out and complete registration again, or contact support.",
        },
        { status: 403 }
      );
    }

    if (input.streamProgress) {
      const { phases } = buildClientAnalyzePhases({
        subject,
        satAdaptiveMode: satAdaptiveMode ?? "none",
        satFormat: resolvedSatFormat,
      });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: ProgressEvent) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          const tracker = createPhaseTracker(emit);
          tracker.init(phases, Date.now());
          try {
            const result = await performAnalyze(input, supabase, tracker);
            tracker.complete({
              type: "complete",
              examId: result.examId,
              questionCount: result.questionCount,
              moduleSummary: result.moduleSummary,
              moduleCountWarning: result.moduleCountWarning,
              moduleCounts: result.moduleCounts,
              moduleReport: result.moduleReport,
            });
          } catch (e) {
            if (e instanceof AnalyzeFailError) {
              tracker.error(
                formatFriendlyAnalyzeError(String(e.payload.error ?? e.message), {
                  failedPhaseId: e.failedPhaseId,
                  moduleSummary:
                    typeof e.payload.moduleSummary === "string"
                      ? e.payload.moduleSummary
                      : undefined,
                  emptyBuckets: Array.isArray(e.payload.emptyBucketKeys)
                    ? (e.payload.emptyBucketKeys as string[])
                    : undefined,
                })
              );
            } else {
              tracker.error(
                formatFriendlyAnalyzeError(
                  e instanceof Error ? e.message : "Analysis failed.",
                  {}
                )
              );
            }
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
        },
      });
    }

    const result = await performAnalyze(input, supabase, null);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AnalyzeFailError) {
      return NextResponse.json(err.payload, { status: err.status });
    }
    console.error("Upload analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 }
    );
  }
}

async function performAnalyze(
  input: AnalyzeInput,
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  tracker: ReturnType<typeof createPhaseTracker> | null
): Promise<AnalyzeSuccessResult> {
  const {
    buffer,
    filename,
    subject: subjectRaw,
    questionCount: questionCountRaw,
    hasVisuals,
    aiProvider,
    userEmail,
    satFormat,
    satAdaptiveMode,
    satCutoffRw,
    satCutoffMath,
    satModuleQuestionCounts: userModuleCounts,
    prefetchedStoragePath,
  } = input;

  const subject = subjectRaw?.trim() ?? "";
  if (getExamProgram(subject as SubjectKey) !== "SAT") {
    throwFail(400, { error: "SAT analyze requires a SAT subject." });
  }

  const isSatFull = isSatFullTest(subject);
  const resolvedSatFormat: SatFormat =
    satFormat ?? (isSatFull ? "full_test" : "single_module");
  const usesSectionPipeline =
    isSatFull || isSatSectionTest(subject, resolvedSatFormat);
  const sectionFilter = isSatSectionTest(subject, resolvedSatFormat)
    ? satSectionForSubject(subject)
    : null;
  // For SAT: user counts are the source of truth. Section pipeline gets its own
  // per-module targets internally; single-module upload uses one number.
  const questionCount = usesSectionPipeline
    ? userModuleCounts
      ? sumModuleCounts(userModuleCounts)
      : questionCountRaw ?? 100
    : (userModuleCounts?.rw1 ?? userModuleCounts?.math1 ?? questionCountRaw);

  const subjectKey = subject as SubjectKey;
    const isCode = isCodeSubject(subjectKey);
    // SAT always has visuals possibilities (Math figures, R&W passages/tables),
    // so let Gemini know to emit page_number/bbox when needed.
    const useHasVisuals = isCode ? true : isSatFull ? true : hasVisuals;
    const examProgram = getExamProgram(subjectKey);
    const isSat = true;

    let userPrompt: string;
    if (isSatFull) {
        const modeLabel =
          satAdaptiveMode === "six_module"
            ? "six-module adaptive (PDF contains M1 + M2-easy + M2-hard per section)"
            : "non-adaptive (only one version of each module)";
        userPrompt = `Analyze the attached Digital SAT FULL TEST PDF and extract ALL multiple-choice + grid-in questions across all 4 modules (Reading & Writing M1, R&W M2, Math M1, Math M2). Adaptive mode: ${modeLabel}. ${
          satCutoffRw != null ? `R&W M1 cutoff = ${satCutoffRw}. ` : ""
        }${satCutoffMath != null ? `Math M1 cutoff = ${satCutoffMath}. ` : ""}Return ONLY a JSON array of objects. Every object MUST include: sat_section ("rw" | "math"), sat_module (1 | 2), sat_module_variant ("easy" | "hard" | null), sat_difficulty (null), question_type ("mcq" | "grid_in"), accepted_answers (array of strings for grid-in or null), options (4 elements A-D for MCQ, [] for grid-in), correct (A/B/C/D for MCQ OR numeric string for grid-in OR null when no answer key in PDF). sat_section and sat_module are MANDATORY and must never be null. Preserve original question order. Do NOT include markdown or explanation, only the JSON array.`;
      } else if (subject === "SAT_RW") {
        const rwTarget = userModuleCounts?.rw1 ?? questionCount ?? 27;
        userPrompt = `Analyze the attached SAT Reading & Writing PDF and extract exactly ${rwTarget} multiple-choice questions (required count: ${rwTarget}; do not return fewer than ${rwTarget} and do not exceed ${rwTarget + 1}). Each object: "type" ("text"), "content" (ONLY the question stem), "image_description" (passage / excerpt; or null), "options" (a JSON array of exactly 4 FULL-TEXT strings A,B,C,D), "correct" (A/B/C/D from the PDF answer key or null; do NOT guess), "question_type": "mcq", "sat_section": "rw" (MANDATORY), "sat_module": 1 or 2 from the PDF header (single-module practice = 1; MANDATORY, never null), "sat_module_variant": null, "sat_difficulty": null, "accepted_answers": null. NO E option ever. Do NOT include has_graph/page_number/bbox. Return only the JSON array.`;
      } else {
        const mathTarget = userModuleCounts?.math1 ?? questionCount ?? 22;
        userPrompt = `Analyze the attached SAT Math PDF and extract exactly ${mathTarget} questions (required count: ${mathTarget}; do not return fewer than ${mathTarget} and do not exceed ${mathTarget + 1}; MCQ + grid-in). Each object: "type" ("text" | "image"), "content" (question text), "image_description" (figure description or null), "has_graph" (boolean), "page_number" (1-based when has_graph is true), "bbox" (0-1 normalized when has_graph is true), "options" (MCQ: 4 FULL-TEXT strings A,B,C,D; grid-in: []), "correct" (A/B/C/D for MCQ OR numeric string like "3/2" for grid-in OR null; do NOT guess), "question_type" ("mcq" | "grid_in"), "accepted_answers" (string array of equivalent numeric forms for grid-in; null for MCQ), "sat_section": "math" (MANDATORY), "sat_module": 1 or 2 (MANDATORY, never null), "sat_module_variant": null, "sat_difficulty": null. NO E option ever. Return only the JSON array.`;
    }

    const systemInstruction = getSystemPrompt(
      subjectKey,
      useHasVisuals,
      isSat
        ? {
            satAdaptiveMode: satAdaptiveMode ?? "none",
            satCutoffRw,
            satCutoffMath,
            satFormat: resolvedSatFormat,
          }
        : undefined
    );
    // Aggregate raw model output across batched SAT calls for diagnostic logging.
    const rawAggregate: string[] = [];
    let questions: GeminiQuestion[] = [];
    let moduleCountWarning: string | undefined;
    let bucketCountsDuringExtract: Record<string, number> = {};
    let bucketCountsAfterFilter: Record<string, number> = {};
    const effectiveAdaptiveMode: SatAdaptiveMode = satAdaptiveMode ?? "none";
    const ingestSection: "rw" | "math" | null =
      subjectKey === "SAT_RW" ? "rw" : subjectKey === "SAT_MATH" ? "math" : null;

    if (aiProvider === "claude") {
      if (buffer.length > GEMINI_INLINE_LIMIT_BYTES) {
        throwFail(
          413,
          {
            error:
              "Claude PDF analysis only supports files up to ~18 MB. Switch to Gemini or upload a smaller PDF.",
          },
          PHASE_EXTRACT
        );
      }
      tracker?.start(PHASE_EXTRACT);
      const base64 = buffer.toString("base64");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemInstruction,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf" as const,
                  data: base64,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      const claudeText = textBlock && "text" in textBlock ? textBlock.text : "";
      rawAggregate.push(claudeText);
      if (!claudeText?.trim()) {
        throwFail(
          502,
          { error: "Claude returned no content. The PDF may be unreadable or empty." },
          PHASE_EXTRACT
        );
      }
      try {
        questions = parseJsonFromResponse(claudeText);
      } catch {
        throwFail(
          502,
          { error: "Failed to parse AI response as JSON. Try again or use a simpler PDF." },
          PHASE_EXTRACT
        );
      }
      tracker?.done(PHASE_EXTRACT, `${questions.length} questions`);
    } else {
      const pdfPart = await buildPdfPart({
        apiKey: process.env.GEMINI_API_KEY!,
        buffer,
        mimeType: "application/pdf",
        displayName: filename,
      });

      if (usesSectionPipeline) {
        const pipelineResult = await runSatSectionExtractPipeline({
          subject,
          sectionFilter,
          effectiveAdaptiveMode,
          userModuleCounts,
          systemInstruction,
          apiKey: process.env.GEMINI_API_KEY!,
          pdfPart,
          tracker,
        });
        rawAggregate.push(...pipelineResult.rawAggregate);
        questions = pipelineResult.questions as GeminiQuestion[];
        bucketCountsDuringExtract = pipelineResult.bucketCountsDuringExtract;
        bucketCountsAfterFilter = pipelineResult.bucketCountsAfterFilter;
        if (pipelineResult.auditWarnings.length > 0) {
          const auditText = pipelineResult.auditWarnings.join("; ");
          moduleCountWarning = moduleCountWarning
            ? `${moduleCountWarning}; ${auditText}`
            : auditText;
        }
      } else {
        tracker?.start(PHASE_EXTRACT);
        const result = await runSatGeminiExtraction({
          apiKey: process.env.GEMINI_API_KEY!,
          systemInstruction,
          userPrompt,
          pdfPart,
          maxOutputTokens: 32768,
        });
        rawAggregate.push(result.rawText);
        questions = result.questions as GeminiQuestion[];
        tracker?.done(PHASE_EXTRACT, `${questions.length} questions`);
      }

      // If Gemini returned nothing at all, surface a clear 502.
      const totalRawLen = rawAggregate.reduce((sum, t) => sum + t.length, 0);
      if (totalRawLen === 0) {
        throwFail(
          502,
          { error: "Gemini returned no content. The PDF may be unreadable or empty." },
          PHASE_EXTRACT
        );
      }
    }

    if (isSat && !usesSectionPipeline) {
      for (const q of questions) {
        applySatIngestPostProcess(q, { section: ingestSection });
      }
      // Force-tag section from subject when the model omitted it (single-module).
      if (ingestSection) {
        for (const q of questions) {
          if (!q.sat_section) q.sat_section = ingestSection;
          if (!q.sat_module) q.sat_module = 1;
        }
      }
      const salvaged = salvageFilterSatQuestions(questions);
      questions = dropRowsWithoutSection(salvaged.kept);
      if (process.env.NODE_ENV === "development" && salvaged.dropped.length > 0) {
        console.info(
          `[upload/analyze] salvage filter dropped ${salvaged.dropped.length} empty rows`
        );
      }
    }

    // Aggregate raw model output for the upload record + diagnostics.
    const rawText = rawAggregate.join("\n---\n");

    let moduleReport: ReturnType<typeof buildSatModuleReport> | undefined;
    let moduleCounts: ReturnType<typeof reportToLegacyModuleCounts> | undefined;
    if (usesSectionPipeline) {
      tracker?.start(PHASE_VALIDATE);
      moduleReport = buildSatModuleReport(questions);
      moduleCounts = reportToLegacyModuleCounts(moduleReport);
      if (process.env.NODE_ENV === "development") {
        for (const [key, parsed] of Object.entries(bucketCountsDuringExtract)) {
          const afterSalvage =
            bucketCountsAfterFilter[key] ?? reportCountForBucketKey(moduleReport, key);
          console.info(
            `[upload/analyze] SAT bucket ${key}: parsed ${parsed} → after salvage ${afterSalvage}`
          );
        }
      }

      const validation = validateSatModuleReport(
        moduleReport,
        effectiveAdaptiveMode,
        null,
        sectionFilter,
        userModuleCounts ? { userModuleCounts } : undefined
      );
      if (!validation.ok) {
        if (process.env.NODE_ENV === "development") {
          console.error("[upload/analyze] SAT incomplete module extraction", {
            moduleReport,
            emptyBuckets: validation.emptyBucketKeys,
          });
        }
        throwFail(
          422,
          {
            error: validation.error,
            moduleCounts,
            moduleReport,
            emptyBucketKeys: validation.emptyBucketKeys,
            moduleSummary: moduleReport ? formatSatModuleReport(moduleReport) : undefined,
          },
          PHASE_VALIDATE
        );
      }
      if (validation.ok && validation.warnings?.length) {
        moduleCountWarning = userModuleCounts
          ? formatTurkishModuleCountWarning(moduleReport, userModuleCounts)
          : `Bazı modüllerde hedef sayıya ulaşılamadı: ${validation.warnings.join("; ")}`;
      }
      tracker?.done(PHASE_VALIDATE);
    }

    // Zero-question = surface a clear 422 instead of silently saving an empty exam.
    if (questions.length === 0) {
      if (process.env.NODE_ENV === "development") {
        console.error("[upload/analyze] zero questions extracted", {
          subject,
          isSat,
          isSatFull,
          aiProvider,
          rawTextLen: rawText.length,
          snippet: rawText.slice(0, 1200),
        });
      } else {
        console.error("[upload/analyze] zero questions extracted", {
          subject,
          isSat,
          isSatFull,
          aiProvider,
          rawTextLen: rawText.length,
        });
      }
      throwFail(
        422,
        {
          error:
            "PDF'ten SAT sorusu çıkarılamadı. PDF çok uzun, taranmış görüntü veya beklenmeyen formatta olabilir. Lütfen tek bir modülü içeren daha küçük/temiz bir PDF deneyin.",
        },
        PHASE_EXTRACT
      );
    }

    const uploadInsertPayload: Record<string, unknown> = {
      user_email: userEmail,
      filename,
      storage_path: prefetchedStoragePath ?? `pending/${filename}`,
      subject,
      original_text: rawText.slice(0, 50_000),
      is_published: true,
      exam_program: examProgram,
    };
    const requestedAtUpload =
      questionCountRaw != null && Number.isInteger(questionCountRaw) && questionCountRaw > 0
        ? questionCountRaw
        : userModuleCounts
          ? Object.values(userModuleCounts).reduce((a, b) => a + (Number(b) || 0), 0) || null
          : null;
    if (requestedAtUpload != null && requestedAtUpload > 0) {
      uploadInsertPayload.requested_question_count = requestedAtUpload;
    }
    if (isSat) {
      uploadInsertPayload.sat_format = resolvedSatFormat;
      uploadInsertPayload.sat_adaptive_mode = usesSectionPipeline
        ? (satAdaptiveMode ?? "none")
        : "none";
      if (satCutoffRw != null && Number.isFinite(satCutoffRw)) {
        uploadInsertPayload.sat_cutoff_rw = satCutoffRw;
      }
      if (satCutoffMath != null && Number.isFinite(satCutoffMath)) {
        uploadInsertPayload.sat_cutoff_math = satCutoffMath;
      }
    }

    tracker?.start(PHASE_SAVE);
    const { data: uploadRow, error: uploadError } = await supabase
      .from("pdf_uploads")
      .insert(uploadInsertPayload)
      .select("id")
      .single();

    if (uploadError || !uploadRow?.id) {
      console.error("pdf_uploads insert error:", uploadError);
      const isDev = process.env.NODE_ENV === "development";
      const detail = isDev && uploadError
        ? ` ${uploadError.code ?? ""} ${uploadError.message ?? ""}`.trim()
        : "";
      throwFail(
        500,
        { error: `Failed to save upload record.${detail}` },
        PHASE_SAVE
      );
    }

    const uploadId = uploadRow.id;

    // Store PDF in Storage for exam page rendering (Macro/Micro graph = exact page image).
    // When the client pre-uploaded via signed URL, just move the object to the
    // canonical key; otherwise upload the in-memory buffer.
    const storageKey = `${uploadId}.pdf`;
    try {
      if (prefetchedStoragePath && prefetchedStoragePath !== storageKey) {
        const { error: moveError } = await supabase.storage
          .from(UPLOADS_BUCKET)
          .move(prefetchedStoragePath, storageKey);
        if (moveError) {
          console.error("PDF storage move error:", moveError);
          // Fallback: upload the buffer we already have in memory.
          const { error: uploadFallbackError } = await supabase.storage
            .from(UPLOADS_BUCKET)
            .upload(storageKey, buffer, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (uploadFallbackError) {
            console.error("PDF storage fallback upload error:", uploadFallbackError);
          }
          // Best-effort cleanup of the pending object.
          await supabase.storage
            .from(UPLOADS_BUCKET)
            .remove([prefetchedStoragePath])
            .catch(() => undefined);
        }
      } else if (!prefetchedStoragePath) {
        const { error: storageError } = await supabase.storage
          .from(UPLOADS_BUCKET)
          .upload(storageKey, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (storageError) {
          console.error("PDF storage upload error:", storageError);
        }
      }
      await supabase.from("pdf_uploads").update({ storage_path: storageKey }).eq("id", uploadId);
    } catch (e) {
      console.error("PDF storage error:", e);
      await supabase.from("pdf_uploads").update({ storage_path: storageKey }).eq("id", uploadId);
    }

    // Section pipeline keeps everything extracted. Single-module SAT trims to
    // the user-provided target (default 100) to stop runaway extractions.
    const sliceLimit: number = usesSectionPipeline
      ? questions.length
      : questionCount ?? questions.length;
    const rows = questions.slice(0, sliceLimit).map((q, i) => {
      const qtype = normalizeQuestionType(q.question_type);
      const opts = optionsToColumns(q.options, isSat);
      const correct = isSat
        ? normalizeCorrectSat(q.correct, qtype)
        : normalizeCorrect(q.correct);
      const isCodeType = q.type === "code";
      let questionText = isCodeType
        ? (q.question ?? q.content ?? "").trim() || "No question text."
        : (q.content ?? "").trim() || "No question text.";
      let passageText: string | null;
      if (isCodeType) {
        const rawCode = (q.code ?? q.content)?.trim() ?? "";
        const { codeOnly, strippedQuestion } = stripQuestionFromCode(rawCode || null);
        const refList = (q.image_description ?? "").trim() || null;
        passageText =
          refList && codeOnly
            ? `${refList}\n\n${codeOnly}`
            : refList || codeOnly || null;
        if (strippedQuestion && (!questionText || questionText === "No question text.")) {
          questionText = strippedQuestion;
        }
      } else {
        passageText = (q.image_description ?? "")?.trim() || null;
      }

      const shared = partitionStemAndSharedIntro(questionText);
      if (shared.intro?.trim() && shared.stem?.trim()) {
        questionText = shared.stem.trim();
        const intro = shared.intro.trim();
        passageText = passageText?.trim()
          ? `${intro}\n\n${passageText}`
          : intro;
      }

      if (isSat) {
        const satSection =
          normalizeSatSection(q.sat_section) ??
          (subjectKey === "SAT_RW" ? "rw" : subjectKey === "SAT_MATH" ? "math" : null);
        const satPart = partitionSatStemAndPassage(questionText, passageText, satSection);
        questionText = satPart.stem;
        passageText = satPart.passage;
      }

      if (isPlaceholderText(questionText)) questionText = "No question text.";
      if (passageText != null && isPlaceholderText(passageText)) passageText = null;

      const isVisualOrPassageSubject = !isCodeSubject(subjectKey);
      if (isVisualOrPassageSubject && passageText != null && looksLikeQuestionStemOnly(passageText)) {
        passageText = null;
      }

      if (isVisualOrPassageSubject) {
        questionText = stripReferenceListFromStem(questionText, passageText);
      }

      const hasAnyOption = [opts.option_a, opts.option_b, opts.option_c, opts.option_d, opts.option_e].some(
        (o) => o != null && o.trim() !== ""
      );
      if (questionText === "No question text." && hasAnyOption) {
        questionText = "Which of the following is correct?";
      }

      const hasGraphExplicit = q.has_graph === true;
      const hasGraphDenied = q.has_graph === false;
      const pageNum =
        q.page_number != null && Number.isInteger(Number(q.page_number))
          ? Number(q.page_number)
          : null;
      const parsedBbox = parseBbox(q.bbox);

      const preconditionText =
        (q.precondition ?? "").trim() || null;

      const hasGraph =
        isVisualOrPassageSubject &&
        useHasVisuals &&
        (hasGraphExplicit || (!hasGraphDenied && pageNum != null));
      const pageNumFinal = isCodeType
        ? (pageNum ?? null)
        : isVisualOrPassageSubject && hasGraph && pageNum != null
          ? pageNum
          : null;
      const bboxVal = isCodeType
        ? null
        : isVisualOrPassageSubject && hasGraph && pageNumFinal != null
          ? parsedBbox
          : null;

      const baseRow: Record<string, unknown> = {
        upload_id: uploadId,
        question_number: i + 1,
        question_text: questionText,
        passage_text: passageText,
        precondition_text: preconditionText,
        option_a: opts.option_a,
        option_b: opts.option_b,
        option_c: opts.option_c,
        option_d: opts.option_d,
        option_e: opts.option_e,
        correct_answer: correct,
        image_url: null,
        has_graph: isVisualOrPassageSubject ? hasGraph : null,
        page_number: pageNumFinal,
        bbox: bboxVal,
      };

      if (isSat) {
        baseRow.question_type = qtype;
        baseRow.accepted_answers = qtype === "grid_in" ? normalizeAcceptedAnswers(q.accepted_answers) : null;
        if (qtype === "grid_in") {
          baseRow.option_a = null;
          baseRow.option_b = null;
          baseRow.option_c = null;
          baseRow.option_d = null;
          baseRow.option_e = null;
        }
        // Determine sat_section: trust AI value, else infer from subject.
        const aiSection = normalizeSatSection(q.sat_section);
        const inferredSection: "rw" | "math" | null = subject === "SAT_RW"
          ? "rw"
          : subject === "SAT_MATH"
            ? "math"
            : aiSection;
        baseRow.sat_section = aiSection ?? inferredSection;
        // sat_module: trust AI; else default to 1 for single-module SAT.
        const aiModule = normalizeSatModule(q.sat_module);
        baseRow.sat_module = aiModule ?? (isSatFull ? 1 : 1);
        baseRow.sat_module_variant = normalizeSatVariant(q.sat_module_variant);
        baseRow.sat_difficulty = normalizeSatDifficulty(q.sat_difficulty);
        const pdfModLabel =
          typeof q.sat_pdf_module_label === "string"
            ? q.sat_pdf_module_label.trim()
            : typeof q.pdf_module_label === "string"
              ? q.pdf_module_label.trim()
              : null;
        if (pdfModLabel) baseRow.sat_pdf_module_label = pdfModLabel;
      }

      return baseRow;
    });

    if (rows.length > 0) {
      const { error: questionsError } = await supabase.from("questions").insert(rows);
      if (questionsError) {
        console.error("questions insert error:", questionsError);
        await supabase.from("pdf_uploads").delete().eq("id", uploadId);
        throwFail(500, { error: "Failed to save questions." }, PHASE_SAVE);
      }
    }

    const answerKeyFromPdfCount = countRowsWithPdfAnswerKey(rows);
    const requestedQuestionCount = userModuleCounts
      ? sumModuleCounts(userModuleCounts)
      : questionCountRaw != null && Number.isInteger(questionCountRaw) && questionCountRaw > 0
        ? questionCountRaw
        : rows.length;
    await supabase
      .from("pdf_uploads")
      .update({
        requested_question_count: requestedQuestionCount,
        answer_key_from_pdf_count: answerKeyFromPdfCount,
      })
      .eq("id", uploadId);

    tracker?.done(PHASE_SAVE);

    return {
      examId: uploadId,
      questionCount: rows.length,
      ...(moduleCounts ? { moduleCounts } : {}),
      ...(moduleReport ? { moduleReport } : {}),
      ...(moduleCountWarning ? { moduleCountWarning } : undefined),
      ...(moduleReport
        ? { moduleSummary: formatSatModuleReport(moduleReport) }
        : {}),
    };
}
