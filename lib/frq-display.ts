import { cn } from "@/lib/utils";
import { examContentSerifClass } from "@/app/exam/exam-ui-tokens";

export type FrqDisplayQuestion = {
  promptHtml: string;
  stimulusHtml: string | null;
  parts: Array<{ label: string; prompt?: string; max_points?: number }>;
};

/** MCQ apStemTextClass equivalent + prose styling for inline code in FRQ stems. */
export const frqStemProseClass = cn(
  "text-[19px] sm:text-[21px] font-medium leading-snug text-gray-900",
  examContentSerifClass,
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.92em]",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5"
);

export const frqPassageProseClass = cn(
  "prose prose-xl max-w-none whitespace-pre-wrap text-[18.8px] text-gray-800 sm:text-[22.8px] leading-relaxed",
  examContentSerifClass,
  "[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]"
);

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextForCompare(text: string): string {
  return stripHtmlToText(text).toLowerCase().replace(/\s+/g, " ");
}

function hasMultipleParts(parts: FrqDisplayQuestion["parts"]): boolean {
  const labeled = parts.filter((p) => p.label?.trim());
  return labeled.length > 1;
}

function isSinglePartQuestion(parts: FrqDisplayQuestion["parts"]): boolean {
  return !hasMultipleParts(parts);
}

/** Build regex patterns that match a part label at the start of plain text. */
function partLabelStartPatterns(label: string): RegExp[] {
  const l = label.trim();
  if (!l) return [];
  const escaped = l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const upper = l.toUpperCase();
  return [
    new RegExp(`^\\(${escaped}\\)`, "i"),
    new RegExp(`^Part\\s*\\(${escaped}\\)`, "i"),
    new RegExp(`^Part\\s+${escaped}[.)\\s:]`, "i"),
    new RegExp(`^${escaped}[.)\\s:]`, "i"),
    ...(l.length === 1 ? [new RegExp(`^${upper}[.)\\s:]`, "i")] : []),
  ];
}

function textStartsWithPartLabel(text: string, labels: string[]): boolean {
  const plain = stripHtmlToText(text);
  if (!plain) return false;
  for (const label of labels) {
    if (partLabelStartPatterns(label).some((re) => re.test(plain))) {
      return true;
    }
  }
  return false;
}

/** Split HTML prompt into block-level chunks (paragraphs, headings, etc.). */
function splitHtmlBlocks(html: string): string[] {
  const trimmed = html?.trim() ?? "";
  if (!trimmed) return [];

  const blockRegex =
    /(<(?:p|h[1-6]|li|blockquote|div|pre|table)[^>]*>[\s\S]*?<\/(?:p|h[1-6]|li|blockquote|div|pre|table)>)/gi;
  const blocks = [...trimmed.matchAll(blockRegex)].map((m) => m[1].trim());
  if (blocks.length > 0) return blocks;

  return trimmed
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinHtmlBlocks(blocks: string[]): string {
  return blocks.filter((b) => b.trim()).join("\n");
}

function extractIntroBlocks(promptHtml: string, partLabels: string[]): string[] {
  return splitHtmlBlocks(promptHtml).filter((block) => !textStartsWithPartLabel(block, partLabels));
}

function extractPartBlocks(promptHtml: string, partLabel: string): string[] {
  if (!partLabel.trim()) return [];
  return splitHtmlBlocks(promptHtml).filter((block) =>
    textStartsWithPartLabel(block, [partLabel])
  );
}

function wrapPlainStem(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (looksLikeHtml(t)) return t;
  const escaped = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped}</p>`;
}

function mergeHtmlSections(...sections: Array<string | null | undefined>): string {
  return sections
    .map((s) => s?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

/**
 * Left panel: stimulus + shared question intro (no part-specific instructions).
 */
export function getFrqLeftPanelHtml(question: FrqDisplayQuestion): string {
  const stimulus = question.stimulusHtml?.trim() ?? "";
  const prompt = question.promptHtml?.trim() ?? "";
  const partLabels = question.parts.map((p) => p.label).filter(Boolean);

  if (isSinglePartQuestion(question.parts)) {
    return stimulus;
  }

  const introBlocks = extractIntroBlocks(prompt, partLabels);
  return mergeHtmlSections(stimulus, joinHtmlBlocks(introBlocks));
}

/**
 * Right panel: HTML stem for the active part only.
 */
export function getFrqPartStemHtml(
  question: FrqDisplayQuestion,
  partLabel: string,
  partPrompt: string
): string {
  const prompt = question.promptHtml?.trim() ?? "";
  const storedPart = partPrompt?.trim() ?? "";

  if (isSinglePartQuestion(question.parts)) {
    const stem = storedPart || prompt;
    if (!stem) return "";
    return looksLikeHtml(stem) ? stem : wrapPlainStem(stem);
  }

  let stem = "";
  if (storedPart) {
    stem = looksLikeHtml(storedPart) ? storedPart : wrapPlainStem(storedPart);
  } else if (partLabel) {
    stem = joinHtmlBlocks(extractPartBlocks(prompt, partLabel));
  }

  if (!stem && prompt) {
    stem = looksLikeHtml(prompt) ? prompt : wrapPlainStem(prompt);
  }

  const leftIntro = normalizeTextForCompare(getFrqLeftPanelHtml(question));
  const stemPlain = normalizeTextForCompare(stem);
  if (leftIntro && stemPlain && (leftIntro === stemPlain || stemPlain.startsWith(leftIntro + " "))) {
    return "";
  }

  return stem.trim();
}

export function hasFrqPartStem(stemHtml: string): boolean {
  return Boolean(stemHtml?.trim());
}
