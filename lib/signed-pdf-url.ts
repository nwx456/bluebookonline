import type { SupabaseClient } from "@supabase/supabase-js";

export const PDF_BUCKET = "pdf_uploads";
export const SIGNED_URL_EXPIRY_SEC = 3600;

/**
 * Create a signed URL for an exam PDF, with pending/ path fallback.
 */
export async function createSignedPdfUrl(
  supabase: SupabaseClient,
  uploadId: string,
  storagePath: string | null | undefined
): Promise<{ url: string | null; error: string | null }> {
  if (!storagePath || !storagePath.endsWith(".pdf")) {
    return { url: null, error: "PDF not available for this exam." };
  }

  let signData: { signedUrl: string } | null = null;
  let signError: { message?: string } | null = null;

  const { data: d1, error: e1 } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SEC);

  signData = d1;
  signError = e1;

  if ((signError || !signData?.signedUrl) && storagePath.startsWith("pending/")) {
    const fallbackPath = `${uploadId}.pdf`;
    const { data: d2, error: e2 } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(fallbackPath, SIGNED_URL_EXPIRY_SEC);
    if (!e2 && d2?.signedUrl) {
      signData = d2;
      signError = null;
    }
  }

  if (signError || !signData?.signedUrl) {
    console.error("Signed URL error:", signError);
    return { url: null, error: "Could not generate PDF link." };
  }

  return { url: signData.signedUrl, error: null };
}
