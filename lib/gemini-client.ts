import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { GEMINI_INLINE_LIMIT_BYTES } from "./pdf-upload-limits";

const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

/** Map deprecated env model names to current API ids. */
const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.5-flash-lite",
  "gemini-1.5-pro": "gemini-2.5-pro",
  "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
};

export type GeminiContents = string | Array<string | Part>;

export interface GeminiGenerationConfig {
  maxOutputTokens?: number;
  responseMimeType?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface GeminiGenerateOptions {
  apiKey: string;
  contents: GeminiContents;
  systemInstruction?: string;
  models?: string[];
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiGenerateResult {
  text: string;
  modelUsed: string;
}

function normalizeModelName(name: string): string {
  const trimmed = name.trim();
  return DEPRECATED_MODEL_ALIASES[trimmed] ?? trimmed;
}

function resolveModels(explicit?: string[]): string[] {
  let models: string[];
  if (explicit && explicit.length > 0) {
    models = explicit;
  } else {
    const csv = process.env.GEMINI_MODELS?.trim();
    if (csv) {
      models = csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      const single = process.env.GEMINI_MODEL?.trim();
      models = single ? [single] : DEFAULT_MODELS;
    }
  }
  const normalized = models.map(normalizeModelName);
  return [...new Set(normalized)];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function classifyGeminiError(msg: string): "billing" | "unavailable" | "not_found" | "other" {
  const lower = msg.toLowerCase();
  if (lower.includes("spending cap") || (lower.includes("429") && lower.includes("quota"))) {
    return "billing";
  }
  if (lower.includes("503") || lower.includes("high demand") || lower.includes("unavailable")) {
    return "unavailable";
  }
  if (lower.includes("404") && lower.includes("not found")) {
    return "not_found";
  }
  return "other";
}

function buildFailureMessage(
  errors: Array<{ model: string; err: unknown }>
): string {
  const primary = errors[0];
  const primaryMsg = primary ? errorMessage(primary.err) : "unknown error";
  const primaryKind = classifyGeminiError(primaryMsg);

  if (primaryKind === "billing") {
    return (
      "Gemini aylık harcama limitiniz dolmuş olabilir. " +
      "https://ai.studio/spend adresinden limiti artırın veya Claude ile deneyin. " +
      `Detail: ${primaryMsg}`
    );
  }
  if (primaryKind === "unavailable") {
    return (
      "Gemini geçici olarak yoğun (503). Birkaç dakika sonra tekrar deneyin. " +
      `Detail: ${primaryMsg}`
    );
  }

  const tried = errors.map((e) => e.model).join(", ");
  const lastErr = errors[errors.length - 1]?.err;
  return `All Gemini models failed (tried: ${tried}). Last error: ${errorMessage(lastErr)}`;
}

function isRetryableError(msg: string): boolean {
  const kind = classifyGeminiError(msg);
  return kind === "unavailable" || kind === "billing";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateWithFallback(
  opts: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const models = resolveModels(opts.models);
  const genAI = new GoogleGenerativeAI(opts.apiKey);
  const errors: Array<{ model: string; err: unknown }> = [];

  for (const modelName of models) {
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (attempt > 0) await sleep(4000);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: opts.systemInstruction,
          ...(opts.generationConfig
            ? { generationConfig: opts.generationConfig }
            : {}),
        });
        const result = await model.generateContent(
          opts.contents as Parameters<typeof model.generateContent>[0]
        );
        const text = result.response.text() ?? "";
        if (!text.trim()) {
          errors.push({ model: modelName, err: new Error("empty response") });
          if (process.env.NODE_ENV === "development") {
            console.warn(`[gemini] ${modelName} returned empty response, trying next`);
          }
          break;
        }
        if (process.env.NODE_ENV === "development" && models.length > 1) {
          console.info(`[gemini] succeeded with ${modelName}`);
        }
        return { text, modelUsed: modelName };
      } catch (err) {
        const msg = errorMessage(err);
        if (attempt === 0 && isRetryableError(msg)) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[gemini] ${modelName} retry after: ${msg}`);
          }
          continue;
        }
        errors.push({ model: modelName, err });
        if (process.env.NODE_ENV === "development") {
          console.warn(`[gemini] ${modelName} failed: ${msg}`);
        }
        break;
      }
    }
  }

  throw new Error(buildFailureMessage(errors));
}

/**
 * Build a Gemini content `Part` for a PDF/image buffer. For files at or below
 * {@link GEMINI_INLINE_LIMIT_BYTES} we embed the bytes as inline base64 data;
 * for larger files we upload via the Gemini File API and reference the file
 * URI. The latter path requires the `@google/generative-ai/server` subpath.
 *
 * The File API requires the GEMINI_API_KEY's project to have generative file
 * uploads enabled (the default for the standard API key).
 */
export async function buildPdfPart(opts: {
  apiKey: string;
  buffer: Buffer;
  mimeType: string;
  displayName?: string;
}): Promise<Part> {
  const { apiKey, buffer, mimeType, displayName } = opts;

  if (buffer.length <= GEMINI_INLINE_LIMIT_BYTES) {
    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    };
  }

  const { GoogleAIFileManager, FileState } = await import(
    "@google/generative-ai/server"
  );

  const manager = new GoogleAIFileManager(apiKey);
  const uploadResponse = await manager.uploadFile(buffer, {
    mimeType,
    displayName: displayName ?? "upload.pdf",
  });

  let fileInfo = uploadResponse.file;
  const startedAt = Date.now();
  const TIMEOUT_MS = 60_000;
  while (fileInfo.state === FileState.PROCESSING) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      throw new Error("Gemini File API timed out while processing the upload.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    fileInfo = await manager.getFile(fileInfo.name);
  }

  if (fileInfo.state !== FileState.ACTIVE) {
    throw new Error(
      `Gemini File API failed to make the file active (state=${fileInfo.state}).`
    );
  }

  return {
    fileData: {
      mimeType: fileInfo.mimeType,
      fileUri: fileInfo.uri,
    },
  };
}
