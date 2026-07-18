import type { Part } from "@google/generative-ai";
import { generateWithFallback } from "@/lib/gemini-client";
import {
  detectPdfSectionMismatchProse,
  parseJsonFromResponseDetailed,
  type ParseFailureReason,
  type SatGeminiExtractQuestion,
} from "@/lib/sat-gemini-extract";

const DEFAULT_MAX_OUTPUT_TOKENS = 32768;

/**
 * Single Gemini call matching AP analyze order: prompt text first, then PDF.
 * No strategy chain, no per-module retries.
 */
export async function runSatApStyleExtraction(args: {
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
  const { text } = await generateWithFallback({
    apiKey: args.apiKey,
    systemInstruction: args.systemInstruction,
    contents: [{ text: args.userPrompt }, args.pdfPart],
    generationConfig: {
      maxOutputTokens: args.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      temperature: args.temperature ?? 0.2,
    },
  });

  const rawText = text ?? "";
  if (!rawText.trim()) {
    return { questions: [], rawText, failureReason: "empty_input" };
  }

  if (detectPdfSectionMismatchProse(rawText)) {
    const { questions, failureReason } = parseJsonFromResponseDetailed(rawText);
    return { questions, rawText, failureReason };
  }

  const { questions, failureReason } = parseJsonFromResponseDetailed(rawText);

  if (
    process.env.NODE_ENV === "development" &&
    questions.length === 0 &&
    rawText.trim().length > 0
  ) {
    console.warn(
      `[sat-ap-style-extract] parse yielded 0 questions failureReason=${failureReason} rawLen=${rawText.length} snippet=${JSON.stringify(rawText.slice(0, 200))}`
    );
  }

  return { questions, rawText, failureReason };
}
