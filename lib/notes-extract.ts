import type { Part } from "@google/generative-ai";
import { buildPdfPart } from "@/lib/gemini-client";
import {
  MAX_NOTES_FILE_BYTES,
  MAX_NOTES_FILES,
  MAX_NOTES_TEXT_CHARS,
} from "@/lib/notes-upload-limits";

export { MAX_NOTES_FILE_BYTES, MAX_NOTES_FILES, MAX_NOTES_TEXT_CHARS };

export type NotesFileKind = "pdf" | "docx" | "txt";

export interface NotesInputFile {
  name: string;
  buffer: Buffer;
  mimeType: string;
  kind: NotesFileKind;
}

export interface PreparedNotesContent {
  textBlocks: string[];
  pdfParts: Part[];
  combinedTextLength: number;
  truncated: boolean;
  truncationNotice: string | null;
  fileSummaries: Array<{ name: string; kind: NotesFileKind; sizeBytes: number }>;
}

const ALLOWED_EXTENSIONS: Record<string, NotesFileKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
};

const MIME_BY_KIND: Record<NotesFileKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

export function detectNotesFileKind(filename: string, mimeType?: string | null): NotesFileKind | null {
  const ext = extensionOf(filename);
  const fromExt = ALLOWED_EXTENSIONS[ext];
  if (fromExt) return fromExt;
  const mime = (mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    return "docx";
  }
  if (mime.startsWith("text/")) return "txt";
  return null;
}

export function validateNotesFiles(
  files: Array<{ name: string; size: number; kind: NotesFileKind | null }>
): { ok: true } | { ok: false; error: string } {
  if (files.length === 0) {
    return { ok: false, error: "Upload at least one notes file (.pdf, .docx, or .txt)." };
  }
  if (files.length > MAX_NOTES_FILES) {
    return { ok: false, error: `You can upload at most ${MAX_NOTES_FILES} files at once.` };
  }
  for (const file of files) {
    if (!file.kind) {
      return {
        ok: false,
        error: `"${file.name}" is not supported. Use PDF, DOCX, or TXT only.`,
      };
    }
    const maxBytes = MAX_NOTES_FILE_BYTES;
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return {
        ok: false,
        error: `"${file.name}" exceeds the ${maxMb} MB limit.`,
      };
    }
  }
  return { ok: true };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

function extractTxtText(buffer: Buffer): string {
  return buffer.toString("utf-8").replace(/^\uFEFF/, "").trim();
}

function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: text.slice(0, maxChars),
    truncated: true,
  };
}

export async function prepareNotesContent(opts: {
  files: NotesInputFile[];
  apiKey: string;
}): Promise<PreparedNotesContent> {
  const textBlocks: string[] = [];
  const pdfParts: Part[] = [];
  const fileSummaries: PreparedNotesContent["fileSummaries"] = [];
  let totalTextLength = 0;
  let truncated = false;

  for (const file of opts.files) {
    fileSummaries.push({
      name: file.name,
      kind: file.kind,
      sizeBytes: file.buffer.length,
    });

    if (file.kind === "pdf") {
      const part = await buildPdfPart({
        apiKey: opts.apiKey,
        buffer: file.buffer,
        mimeType: MIME_BY_KIND.pdf,
        displayName: file.name,
      });
      pdfParts.push(part);
      const header = `=== SOURCE FILE: ${file.name} (PDF — read the attached PDF part for this file) ===`;
      textBlocks.push(header);
      totalTextLength += header.length;
      continue;
    }

    const rawText =
      file.kind === "docx"
        ? await extractDocxText(file.buffer)
        : extractTxtText(file.buffer);

    const header = `=== SOURCE FILE: ${file.name} ===\n${rawText}`;
    const { text, truncated: wasTruncated } = truncateText(
      header,
      Math.max(0, MAX_NOTES_TEXT_CHARS - totalTextLength)
    );
    textBlocks.push(text);
    totalTextLength += text.length;
    if (wasTruncated) truncated = true;
    if (totalTextLength >= MAX_NOTES_TEXT_CHARS) break;
  }

  return {
    textBlocks,
    pdfParts,
    combinedTextLength: totalTextLength,
    truncated,
    truncationNotice: truncated
      ? "Some notes content was truncated because the combined text exceeded the processing limit."
      : null,
    fileSummaries,
  };
}

export function buildGeminiContentsFromNotes(prepared: PreparedNotesContent, prompt: string): Array<string | Part> {
  const contents: Array<string | Part> = [];
  if (prepared.textBlocks.length > 0) {
    contents.push(prepared.textBlocks.join("\n\n"));
  }
  contents.push(...prepared.pdfParts);
  contents.push(prompt);
  return contents;
}
