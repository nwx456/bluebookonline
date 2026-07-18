import { NextRequest, NextResponse } from "next/server";
import { getTeacherClass, usernamesForEmails } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(_request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const [{ data: members }, { data: assignments }] = await Promise.all([
    supabase.from("class_members").select("student_email").eq("class_id", id),
    supabase
      .from("class_assignments")
      .select("id, kind, upload_id, resource_id, due_at")
      .eq("class_id", id)
      .eq("kind", "exam")
      .is("archived_at", null),
  ]);

  const memberEmails = (members ?? []).map((m) =>
    normalizeEmail(m.student_email as string)
  );
  const usernameMap = await usernamesForEmails(supabase, memberEmails);

  const assignmentIds = (assignments ?? []).map((a) => String(a.id));
  let attemptsByKey: Record<string, {
    attemptId: string;
    correctCount: number | null;
    incorrectCount: number | null;
    totalQuestions: number | null;
    percentage: number | null;
    isLate: boolean;
    completedAt: string | null;
  }> = {};

  if (assignmentIds.length > 0 && memberEmails.length > 0) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "id, user_email, assignment_id, correct_count, incorrect_count, total_questions, is_late, completed_at"
      )
      .in("assignment_id", assignmentIds)
      .in("user_email", memberEmails)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    for (const att of attempts ?? []) {
      const key = `${att.assignment_id}:${normalizeEmail(att.user_email as string)}`;
      if (attemptsByKey[key]) continue;
      const correct = att.correct_count as number | null;
      const total = att.total_questions as number | null;
      const percentage =
        correct != null && total != null && total > 0
          ? Math.round((correct / total) * 100)
          : null;
      attemptsByKey[key] = {
        attemptId: String(att.id),
        correctCount: correct,
        incorrectCount: att.incorrect_count as number | null,
        totalQuestions: total,
        percentage,
        isLate: att.is_late === true,
        completedAt: att.completed_at as string | null,
      };
    }
  }

  const uploadIds = (assignments ?? [])
    .map((a) => a.upload_id)
    .filter(Boolean) as string[];
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

  const result = (assignments ?? []).map((assignment) => {
    const studentResults = memberEmails.map((email) => {
      const key = `${assignment.id}:${email}`;
      const attempt = attemptsByKey[key];
      return {
        email,
        username: usernameMap[email] ?? email.split("@")[0],
        completed: Boolean(attempt),
        correctCount: attempt?.correctCount ?? null,
        incorrectCount: attempt?.incorrectCount ?? null,
        totalQuestions: attempt?.totalQuestions ?? null,
        percentage: attempt?.percentage ?? null,
        isLate: attempt?.isLate ?? false,
        completedAt: attempt?.completedAt ?? null,
      };
    });

    const completedCount = studentResults.filter((s) => s.completed).length;
    const lateCount = studentResults.filter((s) => s.isLate).length;
    const avgPercentage =
      completedCount > 0
        ? Math.round(
            studentResults
              .filter((s) => s.percentage != null)
              .reduce((sum, s) => sum + (s.percentage ?? 0), 0) / completedCount
          )
        : null;

    return {
      assignmentId: assignment.id,
      uploadId: assignment.upload_id,
      title: uploadTitles[String(assignment.upload_id)] ?? "Exam",
      dueAt: assignment.due_at,
      memberCount: memberEmails.length,
      completedCount,
      lateCount,
      averagePercentage: avgPercentage,
      students: studentResults,
    };
  });

  return NextResponse.json({ analytics: result });
}
