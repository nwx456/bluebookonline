import type { ModeratorExamKind } from "@/lib/moderator-exam-utils";
import { moderatorUploadTable } from "@/lib/moderator-exam-utils";
import { parseExamSourceFields, type ValidatedExamSource } from "@/lib/exam-source";
import { verifyExamSourceUrl } from "@/lib/exam-source-url-verify";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export type ExamSourceRow = {
  id: string;
  is_published: boolean | null;
  moderation_status: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
};

export function canAdminEditExamSource(row: {
  isPublished: boolean;
  moderationStatus: string | null | undefined;
}): boolean {
  const status = row.moderationStatus ?? "draft";
  if (status === "pending_review") return true;
  return status === "approved" && row.isPublished === true;
}

export function examHasSource(row: {
  sourceType: string | null | undefined;
  sourceName: string | null | undefined;
}): boolean {
  return Boolean(row.sourceType?.trim() && row.sourceName?.trim());
}

export async function loadExamSourceRow(
  examId: string,
  examKind: ModeratorExamKind
): Promise<{ row: ExamSourceRow | null; table: "pdf_uploads" | "frq_uploads" }> {
  const supabase = createServerSupabaseAdmin();
  const table = moderatorUploadTable(examKind);
  const { data, error } = await supabase
    .from(table)
    .select("id, is_published, moderation_status, source_type, source_name, source_url")
    .eq("id", examId)
    .maybeSingle();

  if (error || !data) {
    return { row: null, table };
  }

  return { row: data as ExamSourceRow, table };
}

export async function updateAdminExamSource(params: {
  examId: string;
  examKind: ModeratorExamKind;
  body: unknown;
}): Promise<
  | { ok: true; source: ValidatedExamSource }
  | { ok: false; status: number; error: string }
> {
  const { examId, examKind, body } = params;
  const { row, table } = await loadExamSourceRow(examId, examKind);

  if (!row) {
    return { ok: false, status: 404, error: "Exam not found." };
  }

  const eligible = canAdminEditExamSource({
    isPublished: row.is_published === true,
    moderationStatus: row.moderation_status,
  });

  if (!eligible) {
    return {
      ok: false,
      status: 409,
      error: "Source can only be edited for pending or published exams.",
    };
  }

  const parsed = parseExamSourceFields(
    typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  );

  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }

  if (parsed.normalized.sourceUrl) {
    const urlCheck = await verifyExamSourceUrl(parsed.normalized.sourceUrl);
    if (!urlCheck.ok) {
      return { ok: false, status: 400, error: urlCheck.error };
    }
  }

  const supabase = createServerSupabaseAdmin();
  const { error: updateError } = await supabase
    .from(table)
    .update({
      source_type: parsed.normalized.sourceType,
      source_name: parsed.normalized.sourceName,
      source_url: parsed.normalized.sourceUrl,
      not_official_material_confirmed: true,
    })
    .eq("id", examId);

  if (updateError) {
    console.error("updateAdminExamSource:", updateError);
    return { ok: false, status: 500, error: "Could not save source." };
  }

  return { ok: true, source: parsed.normalized };
}
