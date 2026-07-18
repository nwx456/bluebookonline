import type { Part } from "@google/generative-ai";

export interface SatGeminiExtractQuestion {
  type?: string;
  content?: string;
  question?: string;
  options?: unknown;
  correct?: string | null;
  question_type?: string | null;
  accepted_answers?: string[] | null;
  image_description?: string | null;
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
  sat_pdf_module_label?: string | null;
  pdf_module_label?: string | null;
  [key: string]: unknown;
}

export type ParseFailureReason =
  | "empty_input"
  | "valid_array"
  | "wrapper_unwrapped"
  | "bracket_slice"
  | "truncated_recovery"
  | "not_array"
  | "parse_error";

/** Parse succeeded but model returned an intentional empty JSON array. */
export function isModelEmptyArrayFailure(
  failureReason: ParseFailureReason,
  questionCount: number
): boolean {
  return (
    questionCount === 0 &&
    (failureReason === "valid_array" ||
      failureReason === "wrapper_unwrapped" ||
      failureReason === "bracket_slice")
  );
}

/** Gemini prose explaining the PDF does not contain the requested section. */
export function detectPdfSectionMismatchProse(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  const markers = [
    "yalnızca reading",
    "only reading and writing",
    "only contains reading",
    "yalnızca reading and writing",
    "bulunmamaktadır",
    "does not contain any math",
    "no math questions",
    "hiçbir soru bulunmamaktadır",
    "does not contain math",
    "pdf yalnızca",
    "pdf only contains",
  ];
  return markers.some((m) => lower.includes(m));
}

export interface ParseJsonResult {
  questions: SatGeminiExtractQuestion[];
  failureReason: ParseFailureReason;
}

const WRAPPER_KEYS = ["questions", "data", "items", "results"] as const;

function unwrapToArray(parsed: unknown): SatGeminiExtractQuestion[] | null {
  if (Array.isArray(parsed)) {
    return parsed as SatGeminiExtractQuestion[];
  }
  if (parsed && typeof parsed === "object") {
    const rec = parsed as Record<string, unknown>;
    for (const key of WRAPPER_KEYS) {
      const val = rec[key];
      if (Array.isArray(val)) {
        return val as SatGeminiExtractQuestion[];
      }
    }
  }
  return null;
}

function recoverTruncatedArray(text: string): SatGeminiExtractQuestion[] | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  const slice = text.slice(start);
  let searchEnd = slice.length;
  while (searchEnd > 2) {
    const closeIdx = slice.lastIndexOf("}", searchEnd - 1);
    if (closeIdx <= 0) break;
    const attempt = `${slice.slice(0, closeIdx + 1)}]`;
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as SatGeminiExtractQuestion[];
      }
    } catch {
      // keep trimming
    }
    searchEnd = closeIdx;
  }
  return null;
}

/** Detailed parse with failure reason for logging and tests. */
export function parseJsonFromResponseDetailed(raw: string): ParseJsonResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { questions: [], failureReason: "empty_input" };
  }

  let text = trimmed;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();

  try {
    const parsed = JSON.parse(text) as unknown;
    const arr = unwrapToArray(parsed);
    if (arr) {
      return {
        questions: arr,
        failureReason: Array.isArray(parsed) ? "valid_array" : "wrapper_unwrapped",
      };
    }
    return { questions: [], failureReason: "not_array" };
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice) as unknown;
        const arr = unwrapToArray(parsed);
        if (arr) {
          return { questions: arr, failureReason: "bracket_slice" };
        }
      } catch {
        // fall through to truncated recovery
      }
    }

    const recovered = recoverTruncatedArray(text);
    if (recovered) {
      return { questions: recovered, failureReason: "truncated_recovery" };
    }

    return { questions: [], failureReason: "parse_error" };
  }
}

/** Backward-compatible wrapper returning questions only. */
export function parseJsonFromResponse(raw: string): SatGeminiExtractQuestion[] {
  return parseJsonFromResponseDetailed(raw).questions;
}

/**
 * Run Gemini extraction — delegates to AP-style single call (no strategy chain).
 */
export async function runSatGeminiExtraction(args: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  pdfPart: Part;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<{
  questions: SatGeminiExtractQuestion[];
  rawText: string;
  failureReason?: ParseFailureReason;
}> {
  const { runSatApStyleExtraction } = await import("@/lib/sat-ap-style-extract");
  return runSatApStyleExtraction(args);
}
