import { createHash } from "crypto";

export const PDF_MAGIC = Buffer.from("%PDF-");
export const PDF_EOF = Buffer.from("%%EOF");

export function getMaxBytes(): number {
  const env = Number(process.env.MAX_PDF_BYTES);
  return Number.isFinite(env) && env > 0 ? env : 50 * 1024 * 1024;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  sha256?: string;
  size?: number;
  mime?: string;
}

export function validatePdfBuffer(
  buf: Buffer,
  declaredMime: string | null
): ValidationResult {
  const max = getMaxBytes();
  if (buf.length === 0) return { ok: false, reason: "empty file" };
  if (buf.length > max) return { ok: false, reason: `file too large (${buf.length} > ${max})` };

  if (!buf.subarray(0, 5).equals(PDF_MAGIC)) {
    return { ok: false, reason: "missing %PDF- magic bytes" };
  }

  const tail = buf.subarray(Math.max(0, buf.length - 1024));
  if (tail.indexOf(PDF_EOF) === -1) {
    return { ok: false, reason: "missing %%EOF marker (truncated PDF)" };
  }

  const mime = (declaredMime || "").toLowerCase();
  if (mime && !mime.includes("pdf")) {
    return { ok: false, reason: `unexpected mime: ${mime}` };
  }

  const sha = createHash("sha256").update(buf).digest("hex");
  return {
    ok: true,
    sha256: sha,
    size: buf.length,
    mime: mime || "application/pdf",
  };
}
