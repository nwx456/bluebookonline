import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { isClassMember, usernamesForEmails } from "@/lib/class-server";
import { getInstitutionNamesByIds } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const studentEmail = normalizeEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const member = await isClassMember(supabase, id, studentEmail);
  if (!member) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, description, class_code, teacher_email, institution_id, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (!cls || cls.archived_at) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const [{ data: members }, { data: assignments }] = await Promise.all([
    supabase
      .from("class_members")
      .select("student_email, joined_at")
      .eq("class_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("class_assignments")
      .select("id, kind, upload_id, frq_upload_id, resource_id, due_at, created_at")
      .eq("class_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const memberEmails = (members ?? []).map((m) =>
    normalizeEmail(m.student_email as string)
  );
  const usernameMap = await usernamesForEmails(supabase, memberEmails);

  const frqAssignmentIds = (assignments ?? [])
    .filter((a) => a.kind === "frq_exam")
    .map((a) => String(a.id));

  let myFrqAttempts: Record<string, {
    attemptId: string;
    completed: boolean;
    isLate: boolean;
    totalScore: number | null;
    maxScore: number | null;
    percentage: number | null;
  }> = {};

  if (frqAssignmentIds.length > 0) {
    const { data: frqAttempts } = await supabase
      .from("frq_attempts")
      .select("id, assignment_id, status, is_late, total_score, max_score, completed_at")
      .eq("user_email", studentEmail)
      .in("assignment_id", frqAssignmentIds)
      .order("started_at", { ascending: false });

    for (const att of frqAttempts ?? []) {
      const aid = String(att.assignment_id);
      if (myFrqAttempts[aid]) continue;
      const total = att.max_score as number | null;
      const score = att.total_score as number | null;
      myFrqAttempts[aid] = {
        attemptId: String(att.id),
        completed: att.status === "graded" || att.status === "completed",
        isLate: att.is_late === true,
        totalScore: score,
        maxScore: total,
        percentage:
          score != null && total != null && total > 0
            ? Math.round((Number(score) / Number(total)) * 100)
            : null,
      };
    }
  }

  const examAssignmentIds = (assignments ?? [])
    .filter((a) => a.kind === "exam")
    .map((a) => String(a.id));

  let myAttempts: Record<string, {
    attemptId: string;
    completed: boolean;
    isLate: boolean;
    correctCount: number | null;
    totalQuestions: number | null;
    percentage: number | null;
  }> = {};

  if (examAssignmentIds.length > 0) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "id, assignment_id, completed_at, is_late, correct_count, total_questions"
      )
      .eq("user_email", studentEmail)
      .in("assignment_id", examAssignmentIds)
      .order("started_at", { ascending: false });

    for (const att of attempts ?? []) {
      const aid = String(att.assignment_id);
      if (myAttempts[aid]) continue;
      const correct = att.correct_count as number | null;
      const total = att.total_questions as number | null;
      myAttempts[aid] = {
        attemptId: String(att.id),
        completed: Boolean(att.completed_at),
        isLate: att.is_late === true,
        correctCount: correct,
        totalQuestions: total,
        percentage:
          correct != null && total != null && total > 0
            ? Math.round((correct / total) * 100)
            : null,
      };
    }
  }

  const uploadIds = (assignments ?? [])
    .filter((a) => a.kind === "exam" && a.upload_id)
    .map((a) => String(a.upload_id));
  const frqUploadIds = (assignments ?? [])
    .filter((a) => a.kind === "frq_exam" && a.frq_upload_id)
    .map((a) => String(a.frq_upload_id));
  const resourceIds = (assignments ?? [])
    .filter((a) => a.kind === "resource" && a.resource_id)
    .map((a) => String(a.resource_id));

  let uploadTitles: Record<string, string> = {};
  if (uploadIds.length > 0) {
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, display_title")
      .in("id", uploadIds);
    uploadTitles = Object.fromEntries(
      (uploads ?? []).map((u) => [
        String(u.id),
        (u.display_title as string | null)?.trim() || (u.filename as string) || "Exam",
      ])
    );
  }

  let frqTitles: Record<string, string> = {};
  if (frqUploadIds.length > 0) {
    const { data: frqUploads } = await supabase
      .from("frq_uploads")
      .select("id, title")
      .in("id", frqUploadIds);
    frqTitles = Object.fromEntries(
      (frqUploads ?? []).map((u) => [String(u.id), (u.title as string) || "FRQ Exam"])
    );
  }

  let resourceMeta: Record<string, { title: string; resourceType: string }> = {};
  if (resourceIds.length > 0) {
    const { data: resources } = await supabase
      .from("teacher_resources")
      .select("id, title, resource_type")
      .in("id", resourceIds);
    resourceMeta = Object.fromEntries(
      (resources ?? []).map((r) => [
        String(r.id),
        { title: r.title as string, resourceType: r.resource_type as string },
      ])
    );
  }

  const { data: teacherRow } = await supabase
    .from("usertable")
    .select("username")
    .eq("email", normalizeEmail(cls.teacher_email as string))
    .maybeSingle();

  let institutionName: string | null = null;
  if (cls.institution_id) {
    const names = await getInstitutionNamesByIds(supabase, [String(cls.institution_id)]);
    institutionName = names[String(cls.institution_id)] ?? null;
  }

  return NextResponse.json({
    class: {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      teacherName:
        (teacherRow?.username as string | null)?.trim() ||
        cls.teacher_email?.split("@")[0] ||
        "Teacher",
      institutionId: cls.institution_id,
      institutionName,
      isIndependent: !cls.institution_id,
    },
    classmates: memberEmails.map((email) => ({
      email,
      username: usernameMap[email] ?? email.split("@")[0],
      isSelf: email === studentEmail,
    })),
    assignments: (assignments ?? []).map((a) => {
      const attempt = myAttempts[String(a.id)];
      const frqAttempt = myFrqAttempts[String(a.id)];
      return {
        id: a.id,
        kind: a.kind,
        uploadId: a.upload_id,
        frqUploadId: a.frq_upload_id,
        resourceId: a.resource_id,
        title:
          a.kind === "exam"
            ? uploadTitles[String(a.upload_id)] ?? "Exam"
            : a.kind === "frq_exam"
              ? frqTitles[String(a.frq_upload_id)] ?? "FRQ Exam"
              : resourceMeta[String(a.resource_id)]?.title ?? "Resource",
        resourceType:
          a.kind === "resource"
            ? resourceMeta[String(a.resource_id)]?.resourceType ?? "file"
            : null,
        dueAt: a.due_at,
        attempt: attempt ?? null,
        frqAttempt: frqAttempt ?? null,
      };
    }),
  });
}
