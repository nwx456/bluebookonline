import type { SupabaseClient } from "@supabase/supabase-js";
import type { SatQuestionModuleRow } from "@/lib/sat-effective-question-count";
import { computeSatSixModuleEffectiveCount } from "@/lib/sat-effective-question-count";

const PAGE_SIZE = 1000;
/** Keeps `.in("upload_id", …)` filter sizes reasonable for long query strings. */
const UPLOAD_IDS_IN_CHUNK = 100;

type McqCountRpcRow = { upload_id: string; cnt: number | string };
type FrqCountRpcRow = { frq_upload_id: string; cnt: number | string };

async function countQuestionsViaRpc(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number> | null> {
  if (uploadIds.length === 0) return {};

  const { data, error } = await supabase.rpc("question_counts_by_upload", {
    ids: uploadIds,
  });

  if (error) {
    console.warn("question_counts_by_upload RPC failed, using paginated fallback:", error.message);
    return null;
  }

  const merged: Record<string, number> = {};
  for (const row of (data ?? []) as McqCountRpcRow[]) {
    merged[row.upload_id] = Number(row.cnt) || 0;
  }
  return merged;
}

async function countFrqQuestionsViaRpc(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number> | null> {
  if (uploadIds.length === 0) return {};

  const { data, error } = await supabase.rpc("frq_question_counts_by_upload", {
    ids: uploadIds,
  });

  if (error) {
    console.warn("frq_question_counts_by_upload RPC failed, using paginated fallback:", error.message);
    return null;
  }

  const merged: Record<string, number> = {};
  for (const row of (data ?? []) as FrqCountRpcRow[]) {
    merged[row.frq_upload_id] = Number(row.cnt) || 0;
  }
  return merged;
}

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
  if (uploadIds.length === 0) return {};

  const rpcResult = await countQuestionsViaRpc(supabase, uploadIds);
  if (rpcResult) return rpcResult;

  const merged: Record<string, number> = {};
  for (let i = 0; i < uploadIds.length; i += UPLOAD_IDS_IN_CHUNK) {
    const chunk = uploadIds.slice(i, i + UPLOAD_IDS_IN_CHUNK);
    const partial = await countQuestionsForUploadIdChunk(supabase, chunk);
    for (const [id, n] of Object.entries(partial)) {
      merged[id] = (merged[id] ?? 0) + n;
    }
  }

  return merged;
}

async function countFrqQuestionsForUploadIdChunk(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number>> {
  const countByUpload: Record<string, number> = {};
  if (uploadIds.length === 0) return countByUpload;

  let from = 0;
  for (;;) {
    const { data: page, error } = await supabase
      .from("frq_questions")
      .select("frq_upload_id")
      .in("frq_upload_id", uploadIds)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!page?.length) break;

    for (const row of page) {
      const u = row.frq_upload_id as string;
      countByUpload[u] = (countByUpload[u] ?? 0) + 1;
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return countByUpload;
}

/**
 * Full FRQ question counts per upload id. Paginates past PostgREST max-rows (typically 1000).
 */
export async function countFrqQuestionsByUploadIds(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, number>> {
  if (uploadIds.length === 0) return {};

  const rpcResult = await countFrqQuestionsViaRpc(supabase, uploadIds);
  if (rpcResult) return rpcResult;

  const merged: Record<string, number> = {};
  for (let i = 0; i < uploadIds.length; i += UPLOAD_IDS_IN_CHUNK) {
    const chunk = uploadIds.slice(i, i + UPLOAD_IDS_IN_CHUNK);
    const partial = await countFrqQuestionsForUploadIdChunk(supabase, chunk);
    for (const [id, n] of Object.entries(partial)) {
      merged[id] = (merged[id] ?? 0) + n;
    }
  }

  return merged;
}

/** SAT module metadata grouped by upload id (for six_module effective counts). */
export async function fetchSatQuestionModulesByUploadIds(
  supabase: SupabaseClient,
  uploadIds: string[]
): Promise<Record<string, SatQuestionModuleRow[]>> {
  const grouped: Record<string, SatQuestionModuleRow[]> = {};
  if (uploadIds.length === 0) return grouped;

  for (let i = 0; i < uploadIds.length; i += UPLOAD_IDS_IN_CHUNK) {
    const chunk = uploadIds.slice(i, i + UPLOAD_IDS_IN_CHUNK);
    let from = 0;
    for (;;) {
      const { data: page, error } = await supabase
        .from("questions")
        .select("upload_id, sat_section, sat_module, sat_module_variant")
        .in("upload_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!page?.length) break;

      for (const row of page) {
        const uploadId = row.upload_id as string;
        if (!grouped[uploadId]) grouped[uploadId] = [];
        grouped[uploadId].push({
          sat_section: row.sat_section as string | null,
          sat_module: row.sat_module as number | null,
          sat_module_variant: row.sat_module_variant as string | null,
        });
      }

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return grouped;
}

/** Apply six_module effective counts on top of raw row counts. */
export function applySatSixModuleEffectiveCounts(
  rawCounts: Record<string, number>,
  uploadMeta: Array<{
    id: string;
    exam_program?: string | null;
    sat_adaptive_mode?: string | null;
  }>,
  satModulesByUpload: Record<string, SatQuestionModuleRow[]>
): Record<string, number> {
  const result = { ...rawCounts };
  for (const upload of uploadMeta) {
    if (upload.exam_program !== "SAT" || upload.sat_adaptive_mode !== "six_module") continue;
    const rows = satModulesByUpload[upload.id] ?? [];
    if (rows.length === 0) continue;
    const effective = computeSatSixModuleEffectiveCount(rows);
    if (effective > 0) result[upload.id] = effective;
  }
  return result;
}
