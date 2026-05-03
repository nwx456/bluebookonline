import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
/** Keeps `.in("upload_id", …)` filter sizes reasonable for long query strings. */
const UPLOAD_IDS_IN_CHUNK = 100;

async function countQuestionsForUploadIdChunk(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number>> {
  const countByUpload: Record<string, number> = {};
  if (uploadIds.length === 0) return countByUpload;

  let from = 0;
  for (;;) {
    const { data: page, error } = await supabase
      .from("questions")
      .select("upload_id")
      .in("upload_id", uploadIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!page?.length) break;

    for (const row of page) {
      const u = row.upload_id as string;
      countByUpload[u] = (countByUpload[u] ?? 0) + 1;
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return countByUpload;
}

/**
 * Full question counts per upload id. Paginates past PostgREST max-rows (typically 1000).
 */
export async function countQuestionsByUploadIds(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number>> {
  const merged: Record<string, number> = {};
  if (uploadIds.length === 0) return merged;

  for (let i = 0; i < uploadIds.length; i += UPLOAD_IDS_IN_CHUNK) {
    const chunk = uploadIds.slice(i, i + UPLOAD_IDS_IN_CHUNK);
    const partial = await countQuestionsForUploadIdChunk(supabase, chunk);
    for (const [id, n] of Object.entries(partial)) {
      merged[id] = (merged[id] ?? 0) + n;
    }
  }

  return merged;
}
