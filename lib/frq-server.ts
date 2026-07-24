import type { SupabaseClient } from "@supabase/supabase-js";
import { isPubliclyVisibleExam, normalizeEmail } from "@/lib/moderator-auth";
import { isClassMember } from "@/lib/class-server";

export async function canAccessFrqUpload(
  supabase: SupabaseClient,
  frqUploadId: string,
  userEmail: string
): Promise<boolean> {
  const normalized = normalizeEmail(userEmail);
  const { data: upload } = await supabase
    .from("frq_uploads")
    .select("user_email, status, archived_at, is_published, moderation_status")
    .eq("id", frqUploadId)
    .maybeSingle();

  if (!upload || upload.archived_at || upload.status !== "ready") return false;
  if (normalizeEmail(upload.user_email as string) === normalized) return true;
  if (isPubliclyVisibleExam(upload)) return true;

  // Teachers who assigned it or class members via assignment
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select("class_id")
    .eq("frq_upload_id", frqUploadId)
    .eq("kind", "frq_exam")
    .is("archived_at", null);

  if (!assignments?.length) return false;

  for (const a of assignments) {
    const member = await isClassMember(supabase, String(a.class_id), normalized);
    if (member) return true;
  }
  return false;
}

export async function resolveFrqAssignmentAccess(
  supabase: SupabaseClient,
  opts: {
    assignmentId: string;
    frqUploadId: string;
    studentEmail: string;
  }
): Promise<{ allowed: boolean; dueAt: string | null }> {
  const { data: assignment } = await supabase
    .from("class_assignments")
    .select("id, class_id, kind, frq_upload_id, due_at, archived_at")
    .eq("id", opts.assignmentId)
    .maybeSingle();

  if (!assignment || assignment.archived_at) return { allowed: false, dueAt: null };
  if (assignment.kind !== "frq_exam") return { allowed: false, dueAt: null };
  if (String(assignment.frq_upload_id) !== opts.frqUploadId) return { allowed: false, dueAt: null };

  const member = await isClassMember(
    supabase,
    String(assignment.class_id),
    opts.studentEmail
  );
  if (!member) return { allowed: false, dueAt: null };

  return {
    allowed: true,
    dueAt: (assignment.due_at as string | null) ?? null,
  };
}

export async function canAssignFrqUpload(
  supabase: SupabaseClient,
  frqUploadId: string,
  teacherEmail: string
): Promise<boolean> {
  const normalized = normalizeEmail(teacherEmail);
  const { data } = await supabase
    .from("frq_uploads")
    .select("user_email, status, archived_at")
    .eq("id", frqUploadId)
    .maybeSingle();

  if (!data || data.archived_at || data.status !== "ready") return false;
  return normalizeEmail(data.user_email as string) === normalized;
}

export type FrqUploadRow = {
  id: string;
  user_email: string;
  course_id: string;
  title: string;
  storage_path: string;
  rubric_storage_path: string | null;
  status: string;
  section_duration_min: number | null;
  question_count: number;
  max_score: number;
  error_message: string | null;
  created_at: string;
};

export type FrqQuestionRow = {
  id: string;
  frq_upload_id: string;
  question_number: number;
  question_type: string;
  prompt_html: string;
  stimulus_html: string | null;
  parts: Array<{ label: string; prompt?: string; max_points?: number }>;
  max_points: number;
  scoring_guidelines: Record<string, unknown> | null;
};

export type FrqAttemptRow = {
  id: string;
  user_email: string;
  frq_upload_id: string;
  assignment_id: string | null;
  status: string;
  total_score: number | null;
  max_score: number | null;
  started_at: string;
  completed_at: string | null;
};

export type FrqResponseRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  part_label: string;
  response_text: string;
  is_flagged: boolean;
  score: number | null;
  rubric_breakdown: Record<string, unknown>[] | null;
  ai_feedback: string | null;
};

export type FrqQuestionPart = {
  label: string;
  prompt?: string;
  max_points?: number;
  display_label?: string;
};

/** Normalize parts array; parts-less questions become a single empty-label part. */
export function normalizeFrqParts(
  parts: FrqQuestionPart[] | null | undefined
): FrqQuestionPart[] {
  if (Array.isArray(parts) && parts.length > 0) return parts;
  return [{ label: "", prompt: "" }];
}

/**
 * Distribute question max_points across parts when individual max_points are missing.
 * Uses floor + remainder so part totals exactly equal question max_points.
 */
export function distributePartMaxPoints(
  questionMaxPoints: number,
  parts: FrqQuestionPart[]
): number[] {
  if (parts.length === 0) return [questionMaxPoints];
  const total = Math.max(0, questionMaxPoints);
  const explicit = parts.map((p) =>
    typeof p.max_points === "number" && p.max_points >= 0 ? p.max_points : null
  );
  if (explicit.every((v) => v != null)) {
    return explicit as number[];
  }
  const base = Math.floor(total / parts.length);
  const remainder = total - base * parts.length;
  return parts.map((_, i) => base + (i < remainder ? 1 : 0));
}

/** Max points for a single part (explicit or distributed). */
export function getPartMaxPoints(
  question: Pick<FrqQuestionRow, "max_points" | "parts">,
  partLabel: string
): number {
  const parts = normalizeFrqParts(question.parts);
  const idx = parts.findIndex((p) => (p.label ?? "") === partLabel);
  const part = idx >= 0 ? parts[idx] : parts[0];
  if (typeof part.max_points === "number" && part.max_points >= 0) {
    return part.max_points;
  }
  const distributed = distributePartMaxPoints(question.max_points, parts);
  return distributed[idx >= 0 ? idx : 0] ?? question.max_points;
}

/** Sum of all part max points for a question. */
export function getQuestionMaxPoints(
  question: Pick<FrqQuestionRow, "max_points" | "parts">
): number {
  const parts = normalizeFrqParts(question.parts);
  const distributed = distributePartMaxPoints(question.max_points, parts);
  return distributed.reduce((sum, n) => sum + n, 0);
}

/** Total max score across all questions (part-level sum). */
export function getExamMaxScore(
  questions: Array<Pick<FrqQuestionRow, "max_points" | "parts">>
): number {
  return questions.reduce((sum, q) => sum + getQuestionMaxPoints(q), 0);
}

/** Legacy footer label for a question part, e.g. "1a" or "2". */
export function formatFrqPartLabel(questionNumber: number, partLabel: string): string {
  return partLabel ? `${questionNumber}${partLabel}` : String(questionNumber);
}

/** Full display label honoring PDF display_label when present. */
export function formatFrqPartDisplayLabel(
  questionNumber: number,
  partLabel: string,
  displayLabel?: string | null
): string {
  const pdfLabel = displayLabel?.trim();
  if (pdfLabel) {
    if (/^Part\s+/i.test(pdfLabel)) {
      return `${questionNumber} — ${pdfLabel}`;
    }
    if (/^\([a-z0-9]+\)$/i.test(pdfLabel) || /^[A-Z]\.$/i.test(pdfLabel)) {
      return `${questionNumber} ${pdfLabel}`;
    }
    return `${questionNumber} — ${pdfLabel}`;
  }
  return formatFrqPartLabel(questionNumber, partLabel);
}

/** Compact label for footer grid buttons. */
export function formatFrqPartDisplayLabelCompact(
  questionNumber: number,
  partLabel: string,
  displayLabel?: string | null
): string {
  const pdfLabel = displayLabel?.trim();
  if (pdfLabel) {
    const short = pdfLabel.replace(/^Part\s+/i, "").trim();
    if (/^\([a-z0-9]+\)$/i.test(short) || /^\([ivx]+\)$/i.test(short)) {
      return `${questionNumber}${short}`;
    }
    if (/^[A-Z]\.?$/i.test(short)) {
      return `${questionNumber}${short.replace(/\.$/, "")}`;
    }
    const cleaned = short.replace(/\s+/g, "");
    return cleaned.length <= 4 ? `${questionNumber}${cleaned}` : `${questionNumber}—${cleaned.slice(0, 3)}`;
  }
  return formatFrqPartLabel(questionNumber, partLabel);
}

/** Compare part labels for stable ordering (a, b, c …). */
export function comparePartLabels(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export type FrqFlatPartItem = {
  questionId: string;
  questionNumber: number;
  partLabel: string;
  partDisplayLabel: string | null;
  partPrompt: string;
  partMaxPoints: number;
  displayLabel: string;
  displayLabelCompact: string;
};

/** Flatten questions into ordered part navigation items. */
export function flattenFrqParts(
  questions: Array<
    Pick<FrqQuestionRow, "id" | "question_number" | "max_points" | "parts"> & {
      parts?: FrqQuestionPart[];
    }
  >
): FrqFlatPartItem[] {
  const items: FrqFlatPartItem[] = [];
  for (const q of questions) {
    const parts = normalizeFrqParts(q.parts);
    for (const part of parts) {
      const label = part.label ?? "";
      const partDisplayLabel = part.display_label?.trim() || null;
      items.push({
        questionId: q.id,
        questionNumber: q.question_number,
        partLabel: label,
        partDisplayLabel,
        partPrompt: part.prompt ?? "",
        partMaxPoints: getPartMaxPoints(q, label),
        displayLabel: formatFrqPartDisplayLabel(q.question_number, label, partDisplayLabel),
        displayLabelCompact: formatFrqPartDisplayLabelCompact(
          q.question_number,
          label,
          partDisplayLabel
        ),
      });
    }
  }
  return items;
}
