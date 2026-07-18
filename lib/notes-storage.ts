import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { detectNotesFileKind, type NotesInputFile } from "@/lib/notes-extract";
import {
  MAX_NOTES_FILE_BYTES,
  MAX_NOTES_FILE_MB,
  MAX_NOTES_FILES,
} from "@/lib/notes-upload-limits";

export const NOTES_UPLOADS_BUCKET = "pdf_uploads";
export const NOTES_PENDING_PREFIX = "notes/pending";

export type NotesStoredFileRef = {
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export function normalizeNotesUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeNotesFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "notes.txt";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "notes.txt";
}

export function buildNotesPendingPath(email: string, filename: string): string {
  const normalized = normalizeNotesUserEmail(email);
  const cleanName = sanitizeNotesFilename(filename);
  return `${NOTES_PENDING_PREFIX}/${normalized}/${randomUUID()}-${cleanName}`;
}

export function isNotesPendingPathForUser(path: string, email: string): boolean {
  const normalized = normalizeNotesUserEmail(email);
  const prefix = `${NOTES_PENDING_PREFIX}/${normalized}/`;
  if (!path.startsWith(prefix)) return false;
  const remainder = path.slice(prefix.length);
  if (!remainder || remainder.includes("..") || remainder.includes("\\")) return false;
  return true;
}

export function validateNotesSignedUploadInput(input: {
  filename: string;
  contentType?: string | null;
  size?: number | null;
}): { ok: true } | { ok: false; error: string } {
  const filename = input.filename.trim();
  if (!filename) {
    return { ok: false, error: "Filename is required." };
  }

  const kind = detectNotesFileKind(filename, input.contentType);
  if (!kind) {
    return { ok: false, error: "Only PDF, DOCX, or TXT notes files are accepted." };
  }

  const size = typeof input.size === "number" ? input.size : null;
  if (size != null && (size <= 0 || size > MAX_NOTES_FILE_BYTES)) {
    return {
      ok: false,
      error: `Each notes file must be between 1 byte and ${MAX_NOTES_FILE_MB} MB.`,
    };
  }

  return { ok: true };
}

export function validateNotesStoredFileRefs(
  files: NotesStoredFileRef[]
): { ok: true } | { ok: false; error: string } {
  if (files.length === 0) {
    return { ok: false, error: "Upload at least one notes file (.pdf, .docx, or .txt)." };
  }
  if (files.length > MAX_NOTES_FILES) {
    return { ok: false, error: `You can upload at most ${MAX_NOTES_FILES} files at once.` };
  }

  for (const file of files) {
    if (!file.storagePath?.trim() || !file.filename?.trim()) {
      return { ok: false, error: "Invalid uploaded file reference." };
    }
    const kind = detectNotesFileKind(file.filename, file.mimeType);
    if (!kind) {
      return {
        ok: false,
        error: `"${file.filename}" is not a supported notes file.`,
      };
    }
    if (file.sizeBytes <= 0 || file.sizeBytes > MAX_NOTES_FILE_BYTES) {
      return {
        ok: false,
        error: `"${file.filename}" exceeds the ${MAX_NOTES_FILE_MB} MB limit.`,
      };
    }
  }

  return { ok: true };
}

export async function loadNotesFilesFromStorage(
  supabase: SupabaseClient,
  userEmail: string,
  refs: NotesStoredFileRef[]
): Promise<NotesInputFile[]> {
  const normalized = normalizeNotesUserEmail(userEmail);
  const validation = validateNotesStoredFileRefs(refs);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const downloaded: NotesInputFile[] = [];
  const pendingPaths: string[] = [];

  for (const ref of refs) {
    const storagePath = ref.storagePath.trim();
    if (!isNotesPendingPathForUser(storagePath, normalized)) {
      throw new Error("Invalid storage path.");
    }

    const { data, error } = await supabase.storage
      .from(NOTES_UPLOADS_BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new Error(error?.message ?? `Could not read "${ref.filename}".`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const kind = detectNotesFileKind(ref.filename, ref.mimeType);
    if (!kind) {
      throw new Error(`"${ref.filename}" is not a supported notes file.`);
    }

    downloaded.push({
      name: ref.filename,
      buffer,
      mimeType: ref.mimeType || "application/octet-stream",
      kind,
    });
    pendingPaths.push(storagePath);
  }

  if (pendingPaths.length) {
    await supabase.storage.from(NOTES_UPLOADS_BUCKET).remove(pendingPaths);
  }

  return downloaded;
}
