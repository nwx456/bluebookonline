/**
 * Maximum PDF size accepted by the platform end-to-end.
 *
 * The dashboard uploads directly to Supabase Storage via a signed URL and
 * `/api/upload/analyze` then downloads the file server-side. This avoids the
 * 4.5 MB Vercel request-body limit on the `/api/upload/analyze` endpoint and
 * lets us accept files up to {@link MAX_PDF_UPLOAD_MB}.
 */
export const MAX_PDF_UPLOAD_MB = 50;
export const MAX_PDF_UPLOAD_BYTES = MAX_PDF_UPLOAD_MB * 1024 * 1024;

/**
 * Maximum size for which we can safely embed the PDF as base64 inline data in
 * Gemini `generateContent` requests. Above this threshold we must upload via
 * the Gemini File API and pass the file URI instead.
 *
 * Gemini's documented limit for inline data is 20 MB total request size
 * (which, after base64 expansion, means the raw PDF must be a bit under that).
 * We use 18 MB as a conservative cutoff so we keep some headroom for the
 * prompt itself and base64 overhead.
 */
export const GEMINI_INLINE_LIMIT_MB = 18;
export const GEMINI_INLINE_LIMIT_BYTES = GEMINI_INLINE_LIMIT_MB * 1024 * 1024;
