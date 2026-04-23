import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

const DEFAULT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export type GeminiContents = string | Array<string | Part>;

export interface GeminiGenerateOptions {
  apiKey: string;
  contents: GeminiContents;
  systemInstruction?: string;
  models?: string[];
}

export interface GeminiGenerateResult {
  text: string;
  modelUsed: string;
}

function resolveModels(explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) return explicit;
  return DEFAULT_MODELS;
}

export async function generateWithFallback(
  opts: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const models = resolveModels(opts.models);
  const genAI = new GoogleGenerativeAI(opts.apiKey);
  const errors: Array<{ model: string; err: unknown }> = [];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: opts.systemInstruction,
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
        continue;
      }
      if (process.env.NODE_ENV === "development" && models.length > 1) {
        console.info(`[gemini] succeeded with ${modelName}`);
      }
      return { text, modelUsed: modelName };
    } catch (err) {
      errors.push({ model: modelName, err });
      if (process.env.NODE_ENV === "development") {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[gemini] ${modelName} failed: ${msg}`);
      }
      continue;
    }
  }

  const lastErr = errors[errors.length - 1]?.err;
  const tried = errors.map((e) => e.model).join(", ");
  throw new Error(
    `All Gemini models failed (tried: ${tried}). Last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}
