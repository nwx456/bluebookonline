import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModerationStatus } from "@/lib/moderator-auth";
import type {
  LibraryAttemptItem,
  LibraryEntityType,
  LibraryExamKind,
  LibraryFilters,
  LibraryInsights,
  LibraryInsightsPayload,
  LibrarySort,
  LibrarySummary,
  LibraryTag,
  LibraryUploadItem,
} from "@/lib/library-types";
import { estimateApScore } from "@/lib/ap-score-estimate";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { getInsightsSubjectLabel } from "@/lib/insights-subject-label";

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveUploadModerationStatus(row: {
  moderation_status?: string | null;
  publish_requested_at?: string | null;
}): ModerationStatus {
  const status = row.moderation_status as ModerationStatus | null;
  if (status) return status;
  return row.publish_requested_at ? "pending_review" : "draft";
}

export function resolveDisplayTitle(
  displayTitle: string | null | undefined,
  filename: string | null | undefined
): string {
  const custom = displayTitle?.trim();
  if (custom) return custom;
  return filename?.trim() || "Untitled exam";
}

export function matchesTextQuery(
  q: string,
  fields: Array<string | null | undefined>
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

export async function fetchTagsForEntities(
  supabase: SupabaseClient,
  userEmail: string,
  entityType: LibraryEntityType,
  entityIds: string[]
): Promise<Map<string, LibraryTag[]>> {
  const map = new Map<string, LibraryTag[]>();
  if (entityIds.length === 0) return map;

  const { data: taggings } = await supabase
    .from("user_library_taggings")
    .select("entity_id, tag_id")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  const tagIds = [...new Set((taggings ?? []).map((t) => t.tag_id as string))];
  if (tagIds.length === 0) return map;

  const { data: tags } = await supabase
    .from("user_library_tags")
    .select("id, name, color, created_at")
    .eq("user_email", userEmail)
    .in("id", tagIds);

  const tagById = new Map(
    (tags ?? []).map((tag) => [
      tag.id as string,
      {
        id: tag.id as string,
        name: tag.name as string,
        color: (tag.color as string | null) ?? null,
        createdAt: tag.created_at as string,
      } satisfies LibraryTag,
    ])
  );

  for (const row of taggings ?? []) {
    const entityId = row.entity_id as string;
    const tag = tagById.get(row.tag_id as string);
    if (!tag) continue;
    const list = map.get(entityId) ?? [];
    list.push(tag);
    map.set(entityId, list);
  }

  return map;
}

function sortUploads(items: LibraryUploadItem[], sort: LibrarySort): LibraryUploadItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "score":
      case "newest":
      default:
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
  });
  return copy;
}

function sortAttempts(items: LibraryAttemptItem[], sort: LibrarySort): LibraryAttemptItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "score": {
        const scoreA =
          a.examProgram === "SAT"
            ? a.totalScaledScore ?? a.rwScaledScore ?? a.mathScaledScore ?? -1
            : a.percentage ?? -1;
        const scoreB =
          b.examProgram === "SAT"
            ? b.totalScaledScore ?? b.rwScaledScore ?? b.mathScaledScore ?? -1
            : b.percentage ?? -1;
        return scoreB - scoreA;
      }
      case "newest":
      default:
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    }
  });
  return copy;
}

export async function listLibraryUploads(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryUploadItem[]> {
  const examKind = filters.examKind ?? "all";
  const results: LibraryUploadItem[] = [];
  if (examKind !== "frq") {
    results.push(...(await listMcqLibraryUploads(supabase, userEmail, filters)));
  }
  if (examKind !== "mcq") {
    results.push(...(await listFrqLibraryUploads(supabase, userEmail, filters)));
  }
  return sortUploads(results, filters.sort ?? "newest");
}

async function listMcqLibraryUploads(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryUploadItem[]> {
  const archived = filters.archived === true;
  let query = supabase
    .from("pdf_uploads")
    .select(
      "id, filename, display_title, personal_notes, archived_at, subject, exam_program, created_at, is_published, moderation_status, publish_requested_at, source_type, source_name, source_url"
    )
    .eq("user_email", userEmail);

  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.program === "SAT") query = query.eq("exam_program", "SAT");
  if (filters.program === "AP") query = query.or("exam_program.is.null,exam_program.eq.AP");

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const uploads = rows ?? [];
  const ids = uploads.map((row) => row.id as string);
  const tagMap = await fetchTagsForEntities(supabase, userEmail, "upload", ids);

  let questionCounts: Record<string, number> = {};
  if (ids.length) {
    const { data: questions } = await supabase
      .from("questions")
      .select("upload_id")
      .in("upload_id", ids);
    for (const q of questions ?? []) {
      const uploadId = q.upload_id as string;
      questionCounts[uploadId] = (questionCounts[uploadId] ?? 0) + 1;
    }
  }

  let items: LibraryUploadItem[] = uploads.map((row) => {
    const filename = (row.filename as string | null) ?? "PDF";
    const displayTitle = (row.display_title as string | null) ?? null;
    return {
      id: row.id as string,
      examKind: "mcq" as LibraryExamKind,
      filename,
      displayTitle,
      personalNotes: (row.personal_notes as string | null) ?? null,
      archivedAt: (row.archived_at as string | null) ?? null,
      title: resolveDisplayTitle(displayTitle, filename),
      subject: (row.subject as string) ?? "AP_CSA",
      examProgram:
        (row as { exam_program?: string | null }).exam_program === "SAT" ? "SAT" : "AP",
      questionCount: questionCounts[row.id as string] ?? 0,
      uploadedAt: (row.created_at as string) ?? new Date().toISOString(),
      isPublished: row.is_published === true,
      moderationStatus: resolveUploadModerationStatus(row),
      sourceType: (row.source_type as string | null) ?? null,
      sourceName: (row.source_name as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      tags: tagMap.get(row.id as string) ?? [],
    };
  });

  if (filters.q) {
    items = items.filter((item) =>
      matchesTextQuery(filters.q!, [
        item.title,
        item.filename,
        item.personalNotes,
        item.subject,
      ])
    );
  }

  if (filters.tagIds?.length) {
    const required = new Set(filters.tagIds);
    items = items.filter((item) => {
      const itemTagIds = new Set(item.tags.map((tag) => tag.id));
      return [...required].every((id) => itemTagIds.has(id));
    });
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    items = items.filter((item) => new Date(item.uploadedAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    items = items.filter((item) => new Date(item.uploadedAt).getTime() <= to);
  }

  return items;
}

async function listFrqLibraryUploads(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryUploadItem[]> {
  const archived = filters.archived === true;
  let query = supabase
    .from("frq_uploads")
    .select(
      "id, title, display_title, personal_notes, archived_at, course_id, question_count, max_score, created_at, is_published, moderation_status, publish_requested_at, source_type, source_name, source_url, status"
    )
    .eq("user_email", userEmail)
    .in("status", ["ready", "failed"]);

  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (filters.subject) query = query.eq("course_id", filters.subject);
  if (filters.program === "SAT") return [];

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const uploads = rows ?? [];
  const ids = uploads.map((row) => row.id as string);
  const tagMap = await fetchTagsForEntities(supabase, userEmail, "frq_upload", ids);

  let items: LibraryUploadItem[] = uploads.map((row) => {
    const titleRaw = (row.title as string) ?? "FRQ Exam";
    const displayTitle = (row.display_title as string | null) ?? null;
    const courseId = (row.course_id as string) ?? "AP_US_HISTORY";
    return {
      id: row.id as string,
      examKind: "frq" as LibraryExamKind,
      filename: titleRaw,
      displayTitle,
      personalNotes: (row.personal_notes as string | null) ?? null,
      archivedAt: (row.archived_at as string | null) ?? null,
      title: resolveDisplayTitle(displayTitle, titleRaw),
      subject: courseId,
      examProgram: "AP",
      questionCount: (row.question_count as number) ?? 0,
      maxScore: (row.max_score as number) ?? 0,
      courseId,
      courseLabel: getFrqCourseLabel(courseId),
      uploadedAt: (row.created_at as string) ?? new Date().toISOString(),
      isPublished: row.is_published === true,
      moderationStatus: resolveUploadModerationStatus(row),
      sourceType: (row.source_type as string | null) ?? null,
      sourceName: (row.source_name as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      tags: tagMap.get(row.id as string) ?? [],
    };
  });

  if (filters.q) {
    items = items.filter((item) =>
      matchesTextQuery(filters.q!, [
        item.title,
        item.filename,
        item.personalNotes,
        item.subject,
        item.courseLabel,
      ])
    );
  }

  if (filters.tagIds?.length) {
    const required = new Set(filters.tagIds);
    items = items.filter((item) => {
      const itemTagIds = new Set(item.tags.map((tag) => tag.id));
      return [...required].every((id) => itemTagIds.has(id));
    });
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    items = items.filter((item) => new Date(item.uploadedAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    items = items.filter((item) => new Date(item.uploadedAt).getTime() <= to);
  }

  return items;
}

export async function listLibraryAttempts(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryAttemptItem[]> {
  const examKind = filters.examKind ?? "all";
  const results: LibraryAttemptItem[] = [];
  if (examKind !== "frq") {
    results.push(...(await listMcqLibraryAttempts(supabase, userEmail, filters)));
  }
  if (examKind !== "mcq") {
    results.push(...(await listFrqLibraryAttempts(supabase, userEmail, filters)));
  }
  return sortAttempts(results, filters.sort ?? "newest");
}

async function listMcqLibraryAttempts(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryAttemptItem[]> {
  const archived = filters.archived === true;
  let query = supabase
    .from("attempts")
    .select(
      "id, upload_id, display_title, personal_notes, archived_at, completed_at, correct_count, incorrect_count, unanswered_count, total_questions, skip_ai_grading, module_progress, rw_scaled_score, math_scaled_score, total_scaled_score"
    )
    .eq("user_email", userEmail)
    .not("completed_at", "is", null);

  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data: attempts, error } = await query.order("completed_at", { ascending: false });
  if (error) throw new Error(error.message);

  const attemptList = attempts ?? [];
  const uploadIds = [...new Set(attemptList.map((a) => a.upload_id as string))];
  const attemptIds = attemptList.map((a) => a.id as string);

  const { data: uploads } = uploadIds.length
    ? await supabase
        .from("pdf_uploads")
        .select("id, filename, subject, exam_program")
        .in("id", uploadIds)
    : { data: [] };

  const uploadMap = new Map<
    string,
    { filename: string; subject: string; examProgram: "AP" | "SAT" }
  >(
    (uploads ?? []).map((u) => [
      u.id as string,
      {
        filename: (u.filename as string | null) ?? "PDF",
        subject: (u.subject as string) ?? "AP_CSA",
        examProgram:
          (u as { exam_program?: string | null }).exam_program === "SAT" ? "SAT" : "AP",
      },
    ])
  );

  const tagMap = await fetchTagsForEntities(supabase, userEmail, "attempt", attemptIds);

  let items: LibraryAttemptItem[] = attemptList.map((a) => {
    const upload = uploadMap.get(a.upload_id as string);
    const filename = upload?.filename ?? "PDF";
    const displayTitle = (a.display_title as string | null) ?? null;
    const total = (a.total_questions as number | null) ?? 0;
    const correct = (a.correct_count as number | null) ?? 0;
    const incorrect = (a.incorrect_count as number | null) ?? 0;
    const unanswered = (a.unanswered_count as number | null) ?? 0;
    const notGradedCount = Math.max(0, total - correct - incorrect - unanswered);
    const skipAiGrading = (a.skip_ai_grading as boolean | null) === true || notGradedCount > 0;
    const gradedAnswered = correct + incorrect;
    const percentage = skipAiGrading
      ? gradedAnswered > 0
        ? Math.round((correct / gradedAnswered) * 100)
        : null
      : total > 0
        ? Math.round((correct / total) * 100)
        : 0;

    return {
      id: a.id as string,
      examKind: "mcq" as LibraryExamKind,
      uploadId: a.upload_id as string,
      filename,
      displayTitle,
      personalNotes: (a.personal_notes as string | null) ?? null,
      archivedAt: (a.archived_at as string | null) ?? null,
      title: resolveDisplayTitle(displayTitle, filename),
      subject: upload?.subject ?? "AP_CSA",
      examProgram: upload?.examProgram ?? "AP",
      completedAt: (a.completed_at as string) ?? new Date().toISOString(),
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      notGradedCount,
      skipAiGrading,
      totalQuestions: total,
      percentage,
      moduleProgress:
        a.module_progress && typeof a.module_progress === "object"
          ? (a.module_progress as Record<string, { correct: number; total: number }>)
          : null,
      rwScaledScore: typeof a.rw_scaled_score === "number" ? a.rw_scaled_score : null,
      mathScaledScore: typeof a.math_scaled_score === "number" ? a.math_scaled_score : null,
      totalScaledScore: typeof a.total_scaled_score === "number" ? a.total_scaled_score : null,
      tags: tagMap.get(a.id as string) ?? [],
    };
  });

  if (filters.program) {
    items = items.filter((item) => item.examProgram === filters.program);
  }
  if (filters.subject) {
    items = items.filter((item) => item.subject === filters.subject);
  }
  if (filters.q) {
    items = items.filter((item) =>
      matchesTextQuery(filters.q!, [
        item.title,
        item.filename,
        item.personalNotes,
        item.subject,
      ])
    );
  }
  if (filters.tagIds?.length) {
    const required = new Set(filters.tagIds);
    items = items.filter((item) => {
      const itemTagIds = new Set(item.tags.map((tag) => tag.id));
      return [...required].every((id) => itemTagIds.has(id));
    });
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    items = items.filter((item) => new Date(item.completedAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    items = items.filter((item) => new Date(item.completedAt).getTime() <= to);
  }
  if (filters.scoreMin != null || filters.scoreMax != null) {
    items = items.filter((item) => {
      const score =
        item.examProgram === "SAT"
          ? item.totalScaledScore ?? item.rwScaledScore ?? item.mathScaledScore
          : item.percentage;
      if (score == null) return false;
      if (filters.scoreMin != null && score < filters.scoreMin) return false;
      if (filters.scoreMax != null && score > filters.scoreMax) return false;
      return true;
    });
  }

  return items;
}

async function listFrqLibraryAttempts(
  supabase: SupabaseClient,
  userEmail: string,
  filters: LibraryFilters
): Promise<LibraryAttemptItem[]> {
  const archived = filters.archived === true;
  let query = supabase
    .from("frq_attempts")
    .select(
      "id, frq_upload_id, display_title, personal_notes, archived_at, completed_at, total_score, max_score, status"
    )
    .eq("user_email", userEmail)
    .eq("status", "graded")
    .not("completed_at", "is", null);

  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data: attempts, error } = await query.order("completed_at", { ascending: false });
  if (error) throw new Error(error.message);

  const attemptList = attempts ?? [];
  const uploadIds = [...new Set(attemptList.map((a) => a.frq_upload_id as string))];
  const attemptIds = attemptList.map((a) => a.id as string);

  const { data: uploads } = uploadIds.length
    ? await supabase
        .from("frq_uploads")
        .select("id, title, display_title, course_id, question_count")
        .in("id", uploadIds)
    : { data: [] };

  const uploadMap = new Map(
    (uploads ?? []).map((u) => {
      const courseId = (u.course_id as string) ?? "AP_US_HISTORY";
      const titleRaw = (u.title as string) ?? "FRQ Exam";
      return [
        u.id as string,
        {
          filename: titleRaw,
          displayTitle: (u.display_title as string | null) ?? null,
          subject: courseId,
          courseLabel: getFrqCourseLabel(courseId),
          questionCount: (u.question_count as number) ?? 0,
        },
      ];
    })
  );

  const tagMap = await fetchTagsForEntities(supabase, userEmail, "frq_attempt", attemptIds);

  let items: LibraryAttemptItem[] = attemptList.map((a) => {
    const upload = uploadMap.get(a.frq_upload_id as string);
    const filename = upload?.filename ?? "FRQ Exam";
    const displayTitle = (a.display_title as string | null) ?? null;
    const totalScore = a.total_score != null ? Number(a.total_score) : null;
    const maxScore = a.max_score != null ? Number(a.max_score) : null;
    const percentage =
      totalScore != null && maxScore != null && maxScore > 0
        ? Math.round((totalScore / maxScore) * 100)
        : null;

    return {
      id: a.id as string,
      examKind: "frq" as LibraryExamKind,
      uploadId: a.frq_upload_id as string,
      filename,
      displayTitle,
      personalNotes: (a.personal_notes as string | null) ?? null,
      archivedAt: (a.archived_at as string | null) ?? null,
      title: resolveDisplayTitle(displayTitle, upload?.displayTitle ?? filename),
      subject: upload?.subject ?? "AP_US_HISTORY",
      examProgram: "AP",
      completedAt: (a.completed_at as string) ?? new Date().toISOString(),
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      notGradedCount: 0,
      skipAiGrading: false,
      totalQuestions: upload?.questionCount ?? 0,
      percentage,
      totalScore,
      maxScore,
      moduleProgress: null,
      rwScaledScore: null,
      mathScaledScore: null,
      totalScaledScore: null,
      tags: tagMap.get(a.id as string) ?? [],
    };
  });

  if (filters.program === "SAT") return [];

  if (filters.subject) {
    items = items.filter((item) => item.subject === filters.subject);
  }
  if (filters.q) {
    items = items.filter((item) =>
      matchesTextQuery(filters.q!, [
        item.title,
        item.filename,
        item.personalNotes,
        item.subject,
      ])
    );
  }
  if (filters.tagIds?.length) {
    const required = new Set(filters.tagIds);
    items = items.filter((item) => {
      const itemTagIds = new Set(item.tags.map((tag) => tag.id));
      return [...required].every((id) => itemTagIds.has(id));
    });
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    items = items.filter((item) => new Date(item.completedAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime();
    items = items.filter((item) => new Date(item.completedAt).getTime() <= to);
  }
  if (filters.scoreMin != null || filters.scoreMax != null) {
    items = items.filter((item) => {
      const score = item.percentage;
      if (score == null) return false;
      if (filters.scoreMin != null && score < filters.scoreMin) return false;
      if (filters.scoreMax != null && score > filters.scoreMax) return false;
      return true;
    });
  }

  return items;
}

const TAG_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

function pickTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function mapTagRow(tag: {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}): LibraryTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.created_at,
  };
}

async function deleteOrphanTags(
  supabase: SupabaseClient,
  userEmail: string,
  tagIds: string[]
): Promise<void> {
  if (!tagIds.length) return;

  const { data: stillUsed } = await supabase
    .from("user_library_taggings")
    .select("tag_id")
    .in("tag_id", tagIds);

  const usedIds = new Set((stillUsed ?? []).map((row) => row.tag_id as string));
  const orphanIds = tagIds.filter((id) => !usedIds.has(id));
  if (!orphanIds.length) return;

  await supabase
    .from("user_library_tags")
    .delete()
    .eq("user_email", userEmail)
    .in("id", orphanIds);
}

export async function listUsedLibraryTags(
  supabase: SupabaseClient,
  userEmail: string
): Promise<LibraryTag[]> {
  const { data: tags, error } = await supabase
    .from("user_library_tags")
    .select("id, name, color, created_at")
    .eq("user_email", userEmail)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  if (!tags?.length) return [];

  const tagIds = tags.map((tag) => tag.id as string);
  const { data: usedTaggings, error: usedError } = await supabase
    .from("user_library_taggings")
    .select("tag_id")
    .in("tag_id", tagIds);

  if (usedError) throw new Error(usedError.message);

  const usedIds = new Set((usedTaggings ?? []).map((row) => row.tag_id as string));
  return tags
    .filter((tag) => usedIds.has(tag.id as string))
    .map((tag) =>
      mapTagRow({
        id: tag.id as string,
        name: tag.name as string,
        color: (tag.color as string | null) ?? null,
        created_at: tag.created_at as string,
      })
    );
}

export async function createEntityTag(
  supabase: SupabaseClient,
  userEmail: string,
  entityType: LibraryEntityType,
  entityId: string,
  name: string
): Promise<LibraryTag> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name is required.");
  if (trimmed.length > 40) throw new Error("Tag name must be 40 characters or fewer.");

  const { data: tag, error } = await supabase
    .from("user_library_tags")
    .insert({
      user_email: userEmail,
      name: trimmed,
      color: pickTagColor(trimmed),
    })
    .select("id, name, color, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This tag name is already used on another exam — pick a different name.");
    }
    throw new Error(error.message);
  }

  const { error: taggingError } = await supabase.from("user_library_taggings").insert({
    tag_id: tag.id,
    entity_type: entityType,
    entity_id: entityId,
  });

  if (taggingError) {
    await supabase.from("user_library_tags").delete().eq("id", tag.id);
    throw new Error(taggingError.message);
  }

  return mapTagRow({
    id: tag.id as string,
    name: tag.name as string,
    color: (tag.color as string | null) ?? null,
    created_at: tag.created_at as string,
  });
}

export async function removeEntityTag(
  supabase: SupabaseClient,
  userEmail: string,
  entityType: LibraryEntityType,
  entityId: string,
  tagId: string
): Promise<void> {
  const { data: ownedTag } = await supabase
    .from("user_library_tags")
    .select("id")
    .eq("id", tagId)
    .eq("user_email", userEmail)
    .maybeSingle();

  if (!ownedTag) throw new Error("Tag not found.");

  await supabase
    .from("user_library_taggings")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("tag_id", tagId);

  await deleteOrphanTags(supabase, userEmail, [tagId]);
}

export async function replaceEntityTags(
  supabase: SupabaseClient,
  userEmail: string,
  entityType: LibraryEntityType,
  entityId: string,
  tagIds: string[]
): Promise<void> {
  const uniqueTagIds = [...new Set(tagIds)];

  const { data: previousTaggings } = await supabase
    .from("user_library_taggings")
    .select("tag_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  const previousTagIds = (previousTaggings ?? []).map((row) => row.tag_id as string);

  if (uniqueTagIds.length) {
    const { data: ownedTags } = await supabase
      .from("user_library_tags")
      .select("id")
      .eq("user_email", userEmail)
      .in("id", uniqueTagIds);
    const ownedIds = new Set((ownedTags ?? []).map((tag) => tag.id as string));
    for (const tagId of uniqueTagIds) {
      if (!ownedIds.has(tagId)) {
        throw new Error("One or more tags were not found.");
      }
    }
  }

  await supabase
    .from("user_library_taggings")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  if (uniqueTagIds.length === 0) {
    await deleteOrphanTags(supabase, userEmail, previousTagIds);
    return;
  }

  await supabase.from("user_library_taggings").insert(
    uniqueTagIds.map((tagId) => ({
      tag_id: tagId,
      entity_type: entityType,
      entity_id: entityId,
    }))
  );

  const removedTagIds = previousTagIds.filter((id) => !uniqueTagIds.includes(id));
  await deleteOrphanTags(supabase, userEmail, removedTagIds);
}

function attemptScoreValue(
  attempt: LibraryAttemptItem,
  program: "AP" | "SAT"
): number | null {
  if (attempt.examKind === "frq") {
    return attempt.percentage;
  }
  if (program === "SAT") {
    return attempt.totalScaledScore ?? attempt.rwScaledScore ?? attempt.mathScaledScore;
  }
  return attempt.percentage;
}

function attemptAccuracy(attempt: LibraryAttemptItem): number | null {
  if (attempt.examKind === "frq") {
    return attempt.percentage;
  }
  if (attempt.totalQuestions <= 0) return null;
  return Math.round((attempt.correctCount / attempt.totalQuestions) * 100);
}

function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function buildWeeklyAttempts(attempts: LibraryAttemptItem[]): LibraryInsights["weeklyAttempts"] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    buckets.set(weekStartKey(d), 0);
  }
  for (const attempt of attempts) {
    const key = weekStartKey(new Date(attempt.completedAt));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return [...buckets.entries()].map(([weekStart, count]) => ({
    weekStart,
    label: new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count,
  }));
}

async function countMistakesForAttempts(
  supabase: SupabaseClient,
  attempts: LibraryAttemptItem[],
  program?: "AP" | "SAT"
): Promise<number> {
  const filtered = program
    ? attempts.filter((a) => a.examProgram === program)
    : attempts;
  const attemptIds = filtered.map((a) => a.id);
  if (!attemptIds.length) return 0;

  const { data: wrongRows } = await supabase
    .from("attempt_answers")
    .select("user_answer")
    .in("attempt_id", attemptIds)
    .eq("is_correct", false);

  return (wrongRows ?? []).filter(
    (row) => row.user_answer != null && String(row.user_answer).trim() !== ""
  ).length;
}

export async function buildLibrarySummary(
  supabase: SupabaseClient,
  userEmail: string,
  program: "AP" | "SAT"
): Promise<LibrarySummary> {
  const [activeUploadList, archivedUploadList, activeAttemptList, archivedAttemptList] =
    await Promise.all([
      listLibraryUploads(supabase, userEmail, { archived: false, program }),
      listLibraryUploads(supabase, userEmail, { archived: true, program }),
      listLibraryAttempts(supabase, userEmail, { archived: false, program, sort: "newest" }),
      listLibraryAttempts(supabase, userEmail, { archived: true, program }),
    ]);

  const { data: inProgressRows } = await supabase
    .from("attempts")
    .select("id, upload_id, started_at")
    .eq("user_email", userEmail)
    .is("completed_at", null)
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(20);

  const { data: frqInProgressRows } = await supabase
    .from("frq_attempts")
    .select("id, frq_upload_id, started_at")
    .eq("user_email", userEmail)
    .eq("status", "in_progress")
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(20);

  const inProgressList = inProgressRows ?? [];
  const uploadIds = [...new Set(inProgressList.map((a) => a.upload_id as string))];
  const { data: uploads } = uploadIds.length
    ? await supabase
        .from("pdf_uploads")
        .select("id, filename, subject, exam_program")
        .in("id", uploadIds)
    : { data: [] };

  const uploadMap = new Map(
    (uploads ?? []).map((u) => [
      u.id as string,
      {
        filename: (u.filename as string | null) ?? "PDF",
        subject: (u.subject as string) ?? "AP_CSA",
        examProgram:
          (u as { exam_program?: string | null }).exam_program === "SAT" ? "SAT" : "AP",
      },
    ])
  );

  const inProgressAttempts = [
    ...inProgressList
      .map((a) => {
        const upload = uploadMap.get(a.upload_id as string);
        return {
          id: a.id as string,
          uploadId: a.upload_id as string,
          filename: upload?.filename ?? "PDF",
          subject: upload?.subject ?? "AP_CSA",
          examProgram: (upload?.examProgram ?? "AP") as "AP" | "SAT",
          startedAt: (a.started_at as string) ?? new Date().toISOString(),
        };
      })
      .filter((a) => a.examProgram === program),
    ...(frqInProgressRows ?? [])
      .map((a) => ({
        id: a.id as string,
        uploadId: a.frq_upload_id as string,
        filename: "FRQ Section II",
        subject: "FRQ",
        examProgram: "AP" as const,
        startedAt: (a.started_at as string) ?? new Date().toISOString(),
      }))
      .filter(() => program === "AP"),
  ];

  const mistakeCount = await countMistakesForAttempts(
    supabase,
    activeAttemptList,
    program
  );

  return {
    program,
    activeUploads: activeUploadList.length,
    activeAttempts: activeAttemptList.length,
    inProgress: inProgressAttempts.length,
    mistakeCount,
    archivedUploads: archivedUploadList.length,
    archivedAttempts: archivedAttemptList.length,
    recentAttempts: activeAttemptList.slice(0, 5).map((a) => ({
      id: a.id,
      uploadId: a.uploadId,
      title: a.title,
      subject: a.subject,
      examProgram: a.examProgram,
      examKind: a.examKind,
      completedAt: a.completedAt,
      percentage: a.percentage,
      totalScaledScore: a.totalScaledScore,
      totalScore: a.totalScore,
      maxScore: a.maxScore,
      rwScaledScore: a.rwScaledScore,
      mathScaledScore: a.mathScaledScore,
    })),
    inProgressAttempts,
  };
}

async function aggregateLibraryInsights(
  supabase: SupabaseClient,
  attempts: LibraryAttemptItem[],
  program?: "AP" | "SAT"
): Promise<LibraryInsights> {
  const apPercents = attempts
    .filter(
      (a) =>
        a.examProgram === "AP" &&
        a.percentage != null &&
        (a.examKind === "frq" || a.examKind === "mcq")
    )
    .map((a) => a.percentage as number);
  const satTotals = attempts
    .filter((a) => a.examProgram === "SAT" && a.totalScaledScore != null)
    .map((a) => a.totalScaledScore as number);

  const averagePercentage =
    apPercents.length > 0
      ? Math.round(apPercents.reduce((sum, n) => sum + n, 0) / apPercents.length)
      : null;
  const averageSatTotal =
    satTotals.length > 0
      ? Math.round(satTotals.reduce((sum, n) => sum + n, 0) / satTotals.length)
      : null;

  const attemptIds = attempts.map((a) => a.id);
  let totalMistakes = 0;
  const mistakesBySubject = new Map<string, number>();
  const mistakesBySatSection = new Map<"rw" | "math", number>();

  if (attemptIds.length) {
    const { data: wrongRows } = await supabase
      .from("attempt_answers")
      .select("attempt_id, question_id, is_correct, user_answer")
      .in("attempt_id", attemptIds)
      .eq("is_correct", false);

    const questionIds = [...new Set((wrongRows ?? []).map((row) => row.question_id as string))];
    const { data: questions } = questionIds.length
      ? await supabase
          .from("questions")
          .select("id, upload_id, sat_section")
          .in("id", questionIds)
      : { data: [] };

    const questionMap = new Map(
      (questions ?? []).map((q) => [
        q.id as string,
        {
          uploadId: q.upload_id as string,
          satSection: (q.sat_section as "rw" | "math" | null) ?? null,
        },
      ])
    );

    const attemptById = new Map(attempts.map((a) => [a.id, a]));
    for (const row of wrongRows ?? []) {
      if (row.user_answer == null || String(row.user_answer).trim() === "") continue;
      totalMistakes += 1;
      const attempt = attemptById.get(row.attempt_id as string);
      if (!attempt) continue;
      mistakesBySubject.set(
        attempt.subject,
        (mistakesBySubject.get(attempt.subject) ?? 0) + 1
      );
      const question = questionMap.get(row.question_id as string);
      if (question?.satSection === "rw" || question?.satSection === "math") {
        mistakesBySatSection.set(
          question.satSection,
          (mistakesBySatSection.get(question.satSection) ?? 0) + 1
        );
      }
    }
  }

  const bySubjectMap = new Map<
    string,
    {
      attemptCount: number;
      percentages: number[];
      scores: number[];
      mistakeCount: number;
    }
  >();
  for (const attempt of attempts) {
    const bucket = bySubjectMap.get(attempt.subject) ?? {
      attemptCount: 0,
      percentages: [],
      scores: [],
      mistakeCount: 0,
    };
    bucket.attemptCount += 1;
    if (attempt.percentage != null) bucket.percentages.push(attempt.percentage);
    const score = attemptScoreValue(attempt, program ?? attempt.examProgram);
    if (score != null) bucket.scores.push(score);
    bucket.mistakeCount = mistakesBySubject.get(attempt.subject) ?? 0;
    bySubjectMap.set(attempt.subject, bucket);
  }

  const programKey = program ?? "AP";
  const scoredAttempts = attempts
    .map((a) => ({ attempt: a, score: attemptScoreValue(a, programKey) }))
    .filter((x): x is { attempt: LibraryAttemptItem; score: number } => x.score != null);

  const latestScore =
    scoredAttempts.length > 0 ? scoredAttempts[scoredAttempts.length - 1].score : null;
  const previousScore =
    scoredAttempts.length > 1 ? scoredAttempts[scoredAttempts.length - 2].score : null;
  const bestScore =
    scoredAttempts.length > 0
      ? Math.max(...scoredAttempts.map((x) => x.score))
      : null;
  const scoreDelta =
    latestScore != null && previousScore != null ? latestScore - previousScore : null;

  const satSectionScores = new Map<"rw" | "math", number[]>();
  if (program === "SAT") {
    for (const attempt of attempts) {
      if (attempt.rwScaledScore != null) {
        satSectionScores.set("rw", [...(satSectionScores.get("rw") ?? []), attempt.rwScaledScore]);
      }
      if (attempt.mathScaledScore != null) {
        satSectionScores.set("math", [
          ...(satSectionScores.get("math") ?? []),
          attempt.mathScaledScore,
        ]);
      }
    }
  }

  const accuracyTrend = attempts
    .map((attempt) => {
      const accuracy = attemptAccuracy(attempt);
      if (accuracy == null) return null;
      return {
        id: attempt.id,
        completedAt: attempt.completedAt,
        title: attempt.title,
        accuracy,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return {
    attemptCount: attempts.length,
    averagePercentage,
    averageSatTotal,
    bestScore,
    latestScore,
    scoreDelta,
    trend: attempts.map((attempt) => ({
      id: attempt.id,
      completedAt: attempt.completedAt,
      title: attempt.title,
      examProgram: attempt.examProgram,
      examKind: attempt.examKind,
      percentage: attempt.percentage,
      totalScaledScore: attempt.totalScaledScore,
      accuracy: attemptAccuracy(attempt),
    })),
    accuracyTrend,
    weeklyAttempts: buildWeeklyAttempts(attempts),
    subjectPerformance: [...bySubjectMap.entries()]
      .map(([subject, stats]) => ({
        subject,
        attemptCount: stats.attemptCount,
        averageScore:
          stats.scores.length > 0
            ? Math.round(stats.scores.reduce((sum, n) => sum + n, 0) / stats.scores.length)
            : null,
        mistakeCount: stats.mistakeCount,
      }))
      .sort((a, b) => b.attemptCount - a.attemptCount),
    bySubject: [...bySubjectMap.entries()]
      .map(([subject, stats]) => ({
        subject,
        attemptCount: stats.attemptCount,
        averagePercentage:
          stats.percentages.length > 0
            ? Math.round(
                stats.percentages.reduce((sum, n) => sum + n, 0) / stats.percentages.length
              )
            : null,
        mistakeCount: stats.mistakeCount,
      }))
      .sort((a, b) => b.mistakeCount - a.mistakeCount),
    bySatSection: (["rw", "math"] as const).map((section) => {
      const scores = satSectionScores.get(section) ?? [];
      return {
        section,
        mistakeCount: mistakesBySatSection.get(section) ?? 0,
        averageScaled:
          scores.length > 0
            ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
            : null,
      };
    }),
    totalMistakes,
  };
}

export async function buildLibraryInsights(
  supabase: SupabaseClient,
  userEmail: string,
  options?: { program?: "AP" | "SAT"; subject?: string }
): Promise<LibraryInsightsPayload> {
  const program = options?.program;
  const subject = options?.subject?.trim() || undefined;

  const allAttempts = await listLibraryAttempts(supabase, userEmail, {
    archived: false,
    program,
    sort: "oldest",
  });

  const overall = await aggregateLibraryInsights(supabase, allAttempts, program);

  const availableSubjects = overall.subjectPerformance.map((row) => ({
    id: row.subject,
    label: getInsightsSubjectLabel(row.subject),
    attemptCount: row.attemptCount,
  }));

  let filtered: LibraryInsights | null = null;
  if (subject) {
    const filteredAttempts = allAttempts.filter((a) => a.subject === subject);
    filtered = await aggregateLibraryInsights(supabase, filteredAttempts, program);
  }

  return {
    overall,
    filtered,
    filterSubject: subject ?? null,
    availableSubjects,
  };
}

export function attemptsToCsv(attempts: LibraryAttemptItem[]): string {
  const header = [
    "completed_at",
    "title",
    "subject",
    "program",
    "percentage",
    "ap_estimate",
    "sat_total",
    "sat_rw",
    "sat_math",
    "correct",
    "incorrect",
    "unanswered",
    "tags",
  ];
  const rows = attempts.map((attempt) => [
    attempt.completedAt,
    `"${attempt.title.replace(/"/g, '""')}"`,
    attempt.subject,
    attempt.examProgram,
    attempt.percentage ?? "",
    attempt.examProgram === "AP" && attempt.percentage != null
      ? estimateApScore(attempt.percentage) ?? ""
      : "",
    attempt.totalScaledScore ?? "",
    attempt.rwScaledScore ?? "",
    attempt.mathScaledScore ?? "",
    attempt.correctCount,
    attempt.incorrectCount,
    attempt.unansweredCount,
    `"${attempt.tags.map((tag) => tag.name).join(", ").replace(/"/g, '""')}"`,
  ]);
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
