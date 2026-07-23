import type { SupabaseClient } from "@supabase/supabase-js";
import { generateClassCode, isValidClassCodeFormat, normalizeClassCode } from "@/lib/class-code";
import { isPubliclyVisibleExam, normalizeEmail } from "@/lib/moderator-auth";

export const CLASS_RESOURCES_BUCKET = "class-resources";

export type ClassRow = {
  id: string;
  teacher_email: string;
  name: string;
  description: string | null;
  class_code: string;
  institution_id: string | null;
  created_at: string;
  archived_at: string | null;
};

export async function generateUniqueClassCode(
  supabase: SupabaseClient,
  maxAttempts = 10
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateClassCode();
    const { data } = await supabase
      .from("classes")
      .select("id")
      .eq("class_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return null;
}

export async function getTeacherClass(
  supabase: SupabaseClient,
  classId: string,
  teacherEmail: string
): Promise<ClassRow | null> {
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, teacher_email, name, description, class_code, institution_id, created_at, archived_at"
    )
    .eq("id", classId)
    .eq("teacher_email", normalizeEmail(teacherEmail))
    .maybeSingle();

  if (error) {
    console.error("getTeacherClass error:", error);
    return null;
  }
  return (data as ClassRow | null) ?? null;
}

export async function isClassMember(
  supabase: SupabaseClient,
  classId: string,
  studentEmail: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("class_members")
    .select("student_email")
    .eq("class_id", classId)
    .eq("student_email", normalizeEmail(studentEmail))
    .maybeSingle();

  if (error) {
    console.error("isClassMember error:", error);
    return false;
  }
  return Boolean(data);
}

export async function findClassByCode(
  supabase: SupabaseClient,
  rawCode: string
): Promise<ClassRow | null> {
  const code = normalizeClassCode(rawCode);
  if (!isValidClassCodeFormat(code)) return null;

  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, teacher_email, name, description, class_code, institution_id, created_at, archived_at"
    )
    .eq("class_code", code)
    .maybeSingle();

  if (error) {
    console.error("findClassByCode error:", error);
    return null;
  }
  return (data as ClassRow | null) ?? null;
}

export async function countClassMembers(
  supabase: SupabaseClient,
  classIds: string[]
): Promise<Record<string, number>> {
  if (classIds.length === 0) return {};
  const { data, error } = await supabase
    .from("class_members")
    .select("class_id")
    .in("class_id", classIds);

  if (error) {
    console.error("countClassMembers error:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = String(row.class_id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function countClassAssignments(
  supabase: SupabaseClient,
  classIds: string[]
): Promise<Record<string, number>> {
  if (classIds.length === 0) return {};
  const { data, error } = await supabase
    .from("class_assignments")
    .select("class_id")
    .in("class_id", classIds)
    .is("archived_at", null);

  if (error) {
    console.error("countClassAssignments error:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = String(row.class_id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function resolveAssignmentExamAccess(
  supabase: SupabaseClient,
  opts: {
    assignmentId: string;
    uploadId: string;
    studentEmail: string;
  }
): Promise<{ allowed: boolean; dueAt: string | null }> {
  const { data: assignment, error } = await supabase
    .from("class_assignments")
    .select("id, class_id, kind, upload_id, due_at, archived_at")
    .eq("id", opts.assignmentId)
    .maybeSingle();

  if (error || !assignment) return { allowed: false, dueAt: null };
  if (assignment.archived_at) return { allowed: false, dueAt: null };
  if (assignment.kind !== "exam") return { allowed: false, dueAt: null };
  if (String(assignment.upload_id) !== opts.uploadId) return { allowed: false, dueAt: null };

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

export async function canAssignExamUpload(
  supabase: SupabaseClient,
  uploadId: string,
  teacherEmail: string
): Promise<boolean> {
  const normalized = normalizeEmail(teacherEmail);
  const { data, error } = await supabase
    .from("pdf_uploads")
    .select("user_email, is_published, moderation_status")
    .eq("id", uploadId)
    .maybeSingle();

  if (error || !data) return false;

  const owner = normalizeEmail(data.user_email as string);
  if (owner === normalized) return true;

  return isPubliclyVisibleExam(data);
}

export async function isResourceAccessibleToStudent(
  supabase: SupabaseClient,
  resourceId: string,
  studentEmail: string
): Promise<boolean> {
  const normalized = normalizeEmail(studentEmail);

  const { data: resource, error } = await supabase
    .from("teacher_resources")
    .select("teacher_email, visibility, moderation_status, archived_at")
    .eq("id", resourceId)
    .maybeSingle();

  if (error || !resource || resource.archived_at) return false;

  if (normalizeEmail(resource.teacher_email as string) === normalized) return true;

  if (
    resource.visibility === "public" &&
    resource.moderation_status === "approved"
  ) {
    return true;
  }

  const { data: assignments } = await supabase
    .from("class_assignments")
    .select("class_id")
    .eq("resource_id", resourceId)
    .eq("kind", "resource")
    .is("archived_at", null);

  if (!assignments?.length) return false;

  const classIds = assignments.map((a) => String(a.class_id));
  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("student_email", normalized)
    .in("class_id", classIds);

  return Boolean(memberships?.length);
}

export async function usernamesForEmails(
  supabase: SupabaseClient,
  emails: string[]
): Promise<Record<string, string>> {
  if (emails.length === 0) return {};
  const { data } = await supabase
    .from("usertable")
    .select("email, username")
    .in("email", emails);

  return Object.fromEntries(
    (data ?? []).map((u) => [
      normalizeEmail(u.email as string),
      ((u.username as string | null)?.trim() || u.email?.split("@")[0] || "Student") as string,
    ])
  );
}
