import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { createSignedPdfUrl } from "@/lib/signed-pdf-url";
import { flattenFrqParts } from "@/lib/frq-server";
import { getFrqCourse, getFrqCourseLabel } from "@/lib/frq-courses";
import { isPubliclyVisibleExam } from "@/lib/moderator-auth";

export const MODERATOR_PREVIEW_ATTEMPT_ID = "moderator-preview";

const MCQ_UPLOAD_FIELDS =
  "id, subject, filename, storage_path, exam_program, sat_format, sat_adaptive_mode, sat_cutoff_rw, sat_cutoff_math, source_type, source_name, source_url, moderation_status, is_published, user_email";

export function buildMcqExamPreviewUrl(uploadId: string, questionId: string): string {
  const params = new URLSearchParams({ moderatorPreview: "1", questionId });
  return `/exam/${uploadId}?${params.toString()}`;
}

export function buildFrqExamPreviewUrl(
  uploadId: string,
  questionId: string,
  partLabel: string | null
): string {
  const params = new URLSearchParams({ moderatorPreview: "1", questionId });
  if (partLabel) params.set("partLabel", partLabel);
  return `/frq/${uploadId}?${params.toString()}`;
}

export async function fetchModeratorMcqExamPreview(uploadId: string, questionId: string) {
  const supabase = createServerSupabaseAdmin();

  const { data: upload, error: uploadError } = await supabase
    .from("pdf_uploads")
    .select(MCQ_UPLOAD_FIELDS)
    .eq("id", uploadId)
    .maybeSingle();

  if (uploadError || !upload) {
    return { error: "Exam not found." as const };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("upload_id", uploadId)
    .order("question_number", { ascending: true })
    .order("id", { ascending: true });

  if (questionsError) {
    return { error: "Failed to load questions." as const };
  }

  const list = questions ?? [];
  const targetQuestionIndex = list.findIndex((q) => q.id === questionId);
  if (targetQuestionIndex < 0) {
    return { error: "Question not found on this exam." as const };
  }

  const { url: pdfUrl } = await createSignedPdfUrl(
    supabase,
    uploadId,
    upload.storage_path as string | null
  );

  return {
    upload,
    questions: list,
    targetQuestionId: questionId,
    targetQuestionIndex,
    pdfUrl: pdfUrl ?? null,
  };
}

export async function fetchModeratorFrqExamPreview(
  uploadId: string,
  questionId: string,
  partLabel: string | null
) {
  const supabase = createServerSupabaseAdmin();

  const { data: upload, error: uploadError } = await supabase
    .from("frq_uploads")
    .select("*")
    .eq("id", uploadId)
    .maybeSingle();

  if (uploadError || !upload) {
    return { error: "FRQ exam not found." as const };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("frq_questions")
    .select("*")
    .eq("frq_upload_id", uploadId)
    .order("question_number", { ascending: true });

  if (questionsError) {
    return { error: "Failed to load FRQ questions." as const };
  }

  const mappedQuestions = (questions ?? []).map((q) => ({
    id: q.id as string,
    questionNumber: q.question_number as number,
    questionType: q.question_type as string,
    promptHtml: q.prompt_html as string,
    stimulusHtml: (q.stimulus_html as string | null) ?? null,
    parts: (q.parts as Array<{ label: string; prompt?: string; max_points?: number }>) ?? [],
    maxPoints: q.max_points as number,
    pageRefs: (q.page_refs as number[] | null) ?? null,
  }));

  if (!mappedQuestions.some((q) => q.id === questionId)) {
    return { error: "Question not found on this FRQ exam." as const };
  }

  const course = getFrqCourse(upload.course_id as string);
  const flatItems = flattenFrqParts(
    mappedQuestions.map((q) => ({
      id: q.id,
      question_number: q.questionNumber,
      max_points: q.maxPoints,
      parts: q.parts,
    }))
  );

  const normalizedPart = partLabel?.trim() || null;
  const targetPartIndex = flatItems.findIndex((item) => {
    if (item.questionId !== questionId) return false;
    if (!normalizedPart) return true;
    return item.partLabel.trim().toUpperCase() === normalizedPart.toUpperCase();
  });

  if (targetPartIndex < 0) {
    return { error: "FRQ part not found on this exam." as const };
  }

  const { url: pdfUrl } = await createSignedPdfUrl(
    supabase,
    uploadId,
    upload.storage_path as string | null
  );

  return {
    upload: {
      id: upload.id,
      courseId: upload.course_id,
      courseLabel: getFrqCourseLabel(upload.course_id as string),
      title: upload.title,
      status: upload.status,
      questionCount: upload.question_count,
      maxScore: upload.max_score,
      sectionDurationMin: upload.section_duration_min ?? course?.sectionDurationMin ?? 90,
      sectionDirections: course?.sectionDirections ?? "",
      editorType: course?.editorType ?? "richtext",
      createdAt: upload.created_at,
      isPubliclyVisible: isPubliclyVisibleExam(upload),
      sourceType: (upload.source_type as string | null) ?? null,
      sourceName: (upload.source_name as string | null) ?? null,
      sourceUrl: (upload.source_url as string | null) ?? null,
      ownerEmail: (upload.user_email as string | null) ?? null,
    },
    questions: mappedQuestions,
    targetQuestionId: questionId,
    targetPartIndex,
    pdfUrl: pdfUrl ?? null,
  };
}
