import { NextRequest, NextResponse } from "next/server";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { getTeacherClass } from "@/lib/class-server";
import { getExamProgram } from "@/lib/exam-program";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { listLibraryUploads } from "@/lib/library-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AssignableContentResponse,
  AssignableFrqExam,
  AssignableMcqExam,
  AssignableResource,
} from "@/components/teacher/assign-content-types";

function subjectLabel(subject: string): string {
  if (SUBJECT_KEYS.includes(subject as SubjectKey)) {
    return SUBJECT_LABELS[subject as SubjectKey];
  }
  return subject.replace(/_/g, " ");
}

export async function GET(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const classId = new URL(request.url).searchParams.get("classId")?.trim();
  if (!classId) {
    return NextResponse.json({ error: "classId is required." }, { status: 400 });
  }

  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();

  const cls = await getTeacherClass(supabase, classId, teacherEmail);
  if (!cls || cls.archived_at) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("class_assignments")
    .select("upload_id, frq_upload_id, resource_id")
    .eq("class_id", classId)
    .is("archived_at", null);

  if (assignmentError) {
    console.error("assignable-content assignments:", assignmentError);
    return NextResponse.json({ error: "Could not load assignments." }, { status: 500 });
  }

  const assignedUploadIds = new Set<string>();
  const assignedFrqIds = new Set<string>();
  const assignedResourceIds = new Set<string>();

  for (const row of assignmentRows ?? []) {
    if (row.upload_id) assignedUploadIds.add(String(row.upload_id));
    if (row.frq_upload_id) assignedFrqIds.add(String(row.frq_upload_id));
    if (row.resource_id) assignedResourceIds.add(String(row.resource_id));
  }

  const [ownAp, ownSat, publicExams, frqRows, resourceRows] = await Promise.all([
    listLibraryUploads(supabase, teacherEmail, { examKind: "mcq", archived: false, program: "AP" }),
    listLibraryUploads(supabase, teacherEmail, { examKind: "mcq", archived: false, program: "SAT" }),
    loadPublicMcqExams(supabase),
    loadTeacherFrqExams(supabase, teacherEmail),
    loadTeacherResources(supabase, teacherEmail),
  ]);

  const ownMcq: AssignableMcqExam[] = [...ownAp, ...ownSat].map((item) => ({
    id: item.id,
    title: item.title,
    subject: item.subject,
    subjectLabel: subjectLabel(item.subject),
    examProgram: item.examProgram,
    questionCount: item.questionCount,
    source: "mine" as const,
    moderationStatus: item.moderationStatus,
    alreadyAssigned: assignedUploadIds.has(item.id),
    createdAt: item.uploadedAt,
  }));

  const ownIds = new Set(ownMcq.map((item) => item.id));
  const publicMcq: AssignableMcqExam[] = publicExams
    .filter((item) => !ownIds.has(item.id))
    .map((item) => ({
      ...item,
      alreadyAssigned: assignedUploadIds.has(item.id),
    }));

  const mcqExams = [...ownMcq, ...publicMcq].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const frqExams: AssignableFrqExam[] = frqRows.map((row) => ({
    id: row.id,
    title: row.title,
    courseId: row.courseId,
    courseLabel: row.courseLabel,
    questionCount: row.questionCount,
    maxScore: row.maxScore,
    alreadyAssigned: assignedFrqIds.has(row.id),
    createdAt: row.createdAt,
  }));

  const resources: AssignableResource[] = resourceRows.map((row) => ({
    id: row.id,
    title: row.title,
    resourceType: row.resourceType,
    visibility: row.visibility,
    externalUrl: row.externalUrl,
    alreadyAssigned: assignedResourceIds.has(row.id),
    createdAt: row.createdAt,
  }));

  const payload: AssignableContentResponse = { mcqExams, frqExams, resources };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function loadPublicMcqExams(
  supabase: ReturnType<typeof createServerSupabaseAdmin>
): Promise<Omit<AssignableMcqExam, "alreadyAssigned">[]> {
  const { data: uploads, error } = await supabase
    .from("pdf_uploads")
    .select("id, filename, display_title, subject, user_email, created_at, exam_program, moderation_status")
    .eq("is_published", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const uploadList = uploads ?? [];
  const emails = [...new Set(uploadList.map((u) => u.user_email).filter(Boolean))] as string[];

  let usernameMap: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", emails);
    usernameMap = Object.fromEntries(
      (users ?? []).map((u) => [u.email, u.username?.trim() || "Anonymous"])
    );
  }

  const ids = uploadList.map((u) => u.id as string);
  const countByUpload = await countQuestionsByUploadIds(supabase, ids);

  return uploadList.map((row) => {
    const subject = (row.subject as string) ?? "AP_CSA";
    const examProgram =
      (row.exam_program as string | null) === "SAT"
        ? "SAT"
        : (getExamProgram(subject) as "AP" | "SAT");
    const displayTitle = (row as { display_title?: string | null }).display_title;
    const filename = (row.filename as string | null) ?? "PDF";
    const title = displayTitle?.trim() || filename.trim() || "Untitled exam";

    return {
      id: row.id as string,
      title,
      subject,
      subjectLabel: subjectLabel(subject),
      examProgram,
      questionCount: countByUpload[row.id as string] ?? 0,
      source: "public" as const,
      ownerUsername: usernameMap[row.user_email as string] ?? "Anonymous",
      moderationStatus: (row.moderation_status as string | null) ?? undefined,
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
    };
  });
}

async function loadTeacherFrqExams(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  teacherEmail: string
) {
  const { data, error } = await supabase
    .from("frq_uploads")
    .select("id, course_id, title, status, question_count, max_score, created_at")
    .eq("user_email", teacherEmail)
    .eq("status", "ready")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) ?? "FRQ Exam",
    courseId: row.course_id as string,
    courseLabel: getFrqCourseLabel(row.course_id as string),
    questionCount: (row.question_count as number) ?? 0,
    maxScore: (row.max_score as number) ?? 0,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  }));
}

async function loadTeacherResources(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  teacherEmail: string
) {
  const { data, error } = await supabase
    .from("teacher_resources")
    .select("id, title, resource_type, visibility, external_url, created_at")
    .eq("teacher_email", teacherEmail)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) ?? "Resource",
    resourceType: row.resource_type === "link" ? ("link" as const) : ("file" as const),
    visibility: row.visibility === "public" ? ("public" as const) : ("private" as const),
    externalUrl: (row.external_url as string | null) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  }));
}
