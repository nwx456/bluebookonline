import type { Part } from "@google/generative-ai";
import { generateWithFallback } from "@/lib/gemini-client";

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
  [key: string]: unknown;
}

export function parseJsonFromResponse(raw: string): SatGeminiExtractQuestion[] {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SatGeminiExtractQuestion[];
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice) as unknown;
        if (Array.isArray(parsed)) return parsed as SatGeminiExtractQuestion[];
      } catch {
        // fallback failed
      }
    }
    return [];
  }
}

export async function runSatGeminiExtraction(args: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  pdfPart: Part;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<{ questions: SatGeminiExtractQuestion[]; rawText: string }> {
  const { text } = await generateWithFallback({
    apiKey: args.apiKey,
    systemInstruction: args.systemInstruction,
    contents: [{ text: args.userPrompt }, args.pdfPart],
    generationConfig: {
      maxOutputTokens: args.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      temperature: args.temperature ?? 0.2,
    },
  });
  const rawText = text ?? "";
  if (!rawText.trim()) {
    return { questions: [], rawText };
  }
  let parsed: SatGeminiExtractQuestion[] = [];
  try {
    parsed = parseJsonFromResponse(rawText);
  } catch {
    parsed = [];
  }
  return { questions: parsed, rawText };
}
