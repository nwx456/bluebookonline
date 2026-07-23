import { NextRequest, NextResponse } from "next/server";
import { usernamesForEmails } from "@/lib/class-server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type AttemptResult = {
  completed: boolean;
  percentage: number | null;
  isLate: boolean;
};

function mcqPercentage(correct: number | null, total: number | null): number | null {
  if (correct == null || total == null || total <= 0) return null;
  return Math.round((correct / total) * 100);
}

function frqPercentage(score: number | null, max: number | null): number | null {
  if (score == null || max == null || max <= 0) return null;
  return Math.round((Number(score) / Number(max)) * 100);
}

function averagePercentage(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const institutionId = auth.institution!.id;
  const supabase = createServerSupabaseAdmin();

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, teacher_email")
    .eq("institution_id", institutionId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (classesError) {
    console.error("institution/analytics classes:", classesError);
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }

  const classRows = classes ?? [];
  const classIds = classRows.map((c) => String(c.id));

  if (classIds.length === 0) {
    return NextResponse.json({
      classSummaries: [],
      assignments: [],
      studentSummaries: [],
      teacherSummaries: [],
    });
  }

  const classById = Object.fromEntries(
    classRows.map((c) => [String(c.id), c])
  );

  const [{ data: members }, { data: assignments }] = await Promise.all([
    supabase.from("class_members").select("class_id, student_email").in("class_id", classIds),
    supabase
      .from("class_assignments")
      .select(
        "id, class_id, kind, upload_id, frq_upload_id, assigned_by, due_at, created_at"
      )
      .in("class_id", classIds)
      .in("kind", ["exam", "frq_exam"])
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const membersByClass: Record<string, string[]> = {};
  for (const member of members ?? []) {
    const classId = String(member.class_id);
    const email = normalizeEmail(member.student_email as string);
    if (!membersByClass[classId]) membersByClass[classId] = [];
    if (!membersByClass[classId].includes(email)) {
      membersByClass[classId].push(email);
    }
  }

  const assignmentRows = assignments ?? [];
  const examAssignmentIds = assignmentRows
    .filter((a) => a.kind === "exam")
    .map((a) => String(a.id));
  const frqAssignmentIds = assignmentRows
    .filter((a) => a.kind === "frq_exam")
    .map((a) => String(a.id));

  const allMemberEmails = [
    ...new Set(Object.values(membersByClass).flat()),
  ];

  const resultsByKey: Record<string, AttemptResult> = {};

  if (examAssignmentIds.length > 0 && allMemberEmails.length > 0) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "assignment_id, user_email, correct_count, total_questions, is_late, completed_at"
      )
      .in("assignment_id", examAssignmentIds)
      .in("user_email", allMemberEmails)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    for (const att of attempts ?? []) {
      const key = `${att.assignment_id}:${normalizeEmail(att.user_email as string)}`;
      if (resultsByKey[key]) continue;
      resultsByKey[key] = {
        completed: true,
        percentage: mcqPercentage(
          att.correct_count as number | null,
          att.total_questions as number | null
        ),
        isLate: att.is_late === true,
      };
    }
  }

  if (frqAssignmentIds.length > 0 && allMemberEmails.length > 0) {
    const { data: frqAttempts } = await supabase
      .from("frq_attempts")
      .select(
        "assignment_id, user_email, status, total_score, max_score, is_late, completed_at, started_at"
      )
      .in("assignment_id", frqAssignmentIds)
      .in("user_email", allMemberEmails)
      .order("started_at", { ascending: false });

    for (const att of frqAttempts ?? []) {
      const key = `${att.assignment_id}:${normalizeEmail(att.user_email as string)}`;
      if (resultsByKey[key]) continue;
      const completed =
        att.status === "graded" ||
        att.status === "completed" ||
        att.status === "grading";
      resultsByKey[key] = {
        completed,
        percentage: completed
          ? frqPercentage(
              att.total_score as number | null,
              att.max_score as number | null
            )
          : null,
        isLate: att.is_late === true,
      };
    }
  }

  const uploadIds = assignmentRows
    .filter((a) => a.kind === "exam" && a.upload_id)
    .map((a) => String(a.upload_id));
  const frqUploadIds = assignmentRows
    .filter((a) => a.kind === "frq_exam" && a.frq_upload_id)
    .map((a) => String(a.frq_upload_id));

  const [uploadTitles, frqTitles, teacherNames, studentNames] = await Promise.all([
    uploadIds.length > 0
      ? supabase
          .from("pdf_uploads")
          .select("id, filename, display_title")
          .in("id", uploadIds)
          .then(({ data }) =>
            Object.fromEntries(
              (data ?? []).map((u) => [
                String(u.id),
                (u.display_title as string | null)?.trim() ||
                  (u.filename as string) ||
                  "Exam",
              ])
            )
          )
      : Promise.resolve({} as Record<string, string>),
    frqUploadIds.length > 0
      ? supabase
          .from("frq_uploads")
          .select("id, title")
          .in("id", frqUploadIds)
          .then(({ data }) =>
            Object.fromEntries(
              (data ?? []).map((u) => [
                String(u.id),
                (u.title as string) || "FRQ Exam",
              ])
            )
          )
      : Promise.resolve({} as Record<string, string>),
    usernamesForEmails(
      supabase,
      [
        ...new Set([
          ...classRows.map((c) => normalizeEmail(c.teacher_email as string)),
          ...assignmentRows.map((a) =>
            normalizeEmail(a.assigned_by as string)
          ),
        ]),
      ]
    ),
    usernamesForEmails(supabase, allMemberEmails),
  ]);

  const assignmentSummaries = assignmentRows.map((assignment) => {
    const classId = String(assignment.class_id);
    const cls = classById[classId];
    const memberEmails = membersByClass[classId] ?? [];

    const studentResults = memberEmails.map((email) => {
      const key = `${assignment.id}:${email}`;
      const result = resultsByKey[key];
      return {
        email,
        completed: result?.completed ?? false,
        percentage: result?.percentage ?? null,
        isLate: result?.isLate ?? false,
      };
    });

    const completedCount = studentResults.filter((s) => s.completed).length;
    const lateCount = studentResults.filter((s) => s.isLate).length;
    const memberCount = memberEmails.length;

    const title =
      assignment.kind === "frq_exam"
        ? frqTitles[String(assignment.frq_upload_id)] ?? "FRQ Exam"
        : uploadTitles[String(assignment.upload_id)] ?? "Exam";

    const assignedByEmail = normalizeEmail(assignment.assigned_by as string);

    return {
      assignmentId: assignment.id,
      classId,
      className: (cls?.name as string) ?? "Class",
      title,
      kind: assignment.kind as "exam" | "frq_exam",
      assignedBy: assignedByEmail,
      assignedByName:
        teacherNames[assignedByEmail] ??
        assignedByEmail.split("@")[0] ??
        "Teacher",
      dueAt: assignment.due_at,
      createdAt: assignment.created_at as string,
      memberCount,
      completedCount,
      lateCount,
      completionRate:
        memberCount > 0 ? Math.round((completedCount / memberCount) * 100) : 0,
      averagePercentage: averagePercentage(
        studentResults.map((s) => s.percentage)
      ),
    };
  });

  const classSummaries = classRows.map((cls) => {
    const classId = String(cls.id);
    const memberEmails = membersByClass[classId] ?? [];
    const classAssignments = assignmentSummaries.filter((a) => a.classId === classId);
    const teacherEmail = normalizeEmail(cls.teacher_email as string);

    let totalSlots = 0;
    let completedSlots = 0;
    const percentages: (number | null)[] = [];

    for (const assignment of classAssignments) {
      for (const email of memberEmails) {
        totalSlots += 1;
        const key = `${assignment.assignmentId}:${email}`;
        const result = resultsByKey[key];
        if (result?.completed) {
          completedSlots += 1;
          percentages.push(result.percentage);
        }
      }
    }

    return {
      classId,
      className: cls.name as string,
      teacherEmail,
      teacherName: teacherNames[teacherEmail] ?? teacherEmail.split("@")[0] ?? "Teacher",
      studentCount: memberEmails.length,
      assignmentCount: classAssignments.length,
      completionRate:
        totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
      averagePercentage: averagePercentage(percentages),
    };
  });

  const studentAssignmentMap: Record<
    string,
    { assigned: Set<string>; completed: Set<string>; percentages: number[] }
  > = {};

  for (const assignment of assignmentRows) {
    const classId = String(assignment.class_id);
    const memberEmails = membersByClass[classId] ?? [];
    const assignmentId = String(assignment.id);

    for (const email of memberEmails) {
      if (!studentAssignmentMap[email]) {
        studentAssignmentMap[email] = {
          assigned: new Set(),
          completed: new Set(),
          percentages: [],
        };
      }
      studentAssignmentMap[email].assigned.add(assignmentId);
      const key = `${assignmentId}:${email}`;
      const result = resultsByKey[key];
      if (result?.completed) {
        studentAssignmentMap[email].completed.add(assignmentId);
        if (result.percentage != null) {
          studentAssignmentMap[email].percentages.push(result.percentage);
        }
      }
    }
  }

  const studentSummaries = Object.entries(studentAssignmentMap)
    .map(([email, stats]) => ({
      email,
      username: studentNames[email] ?? email.split("@")[0] ?? "Student",
      assignedCount: stats.assigned.size,
      completedCount: stats.completed.size,
      completionRate:
        stats.assigned.size > 0
          ? Math.round((stats.completed.size / stats.assigned.size) * 100)
          : 0,
      averagePercentage:
        stats.percentages.length > 0
          ? Math.round(
              stats.percentages.reduce((sum, v) => sum + v, 0) /
                stats.percentages.length
            )
          : null,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  type TeacherStats = {
    classIds: Set<string>;
    studentEmails: Set<string>;
    assignmentCount: number;
    lastAssignedAt: string | null;
  };

  const teacherStatsMap: Record<string, TeacherStats> = {};

  for (const cls of classRows) {
    const teacherEmail = normalizeEmail(cls.teacher_email as string);
    const classId = String(cls.id);
    if (!teacherStatsMap[teacherEmail]) {
      teacherStatsMap[teacherEmail] = {
        classIds: new Set(),
        studentEmails: new Set(),
        assignmentCount: 0,
        lastAssignedAt: null,
      };
    }
    teacherStatsMap[teacherEmail].classIds.add(classId);
    for (const email of membersByClass[classId] ?? []) {
      teacherStatsMap[teacherEmail].studentEmails.add(email);
    }
  }

  for (const assignment of assignmentRows) {
    const teacherEmail = normalizeEmail(assignment.assigned_by as string);
    const classId = String(assignment.class_id);
    if (!teacherStatsMap[teacherEmail]) {
      teacherStatsMap[teacherEmail] = {
        classIds: new Set(),
        studentEmails: new Set(),
        assignmentCount: 0,
        lastAssignedAt: null,
      };
    }
    teacherStatsMap[teacherEmail].classIds.add(classId);
    teacherStatsMap[teacherEmail].assignmentCount += 1;
    for (const email of membersByClass[classId] ?? []) {
      teacherStatsMap[teacherEmail].studentEmails.add(email);
    }
    const createdAt = assignment.created_at as string | null;
    if (
      createdAt &&
      (!teacherStatsMap[teacherEmail].lastAssignedAt ||
        createdAt > teacherStatsMap[teacherEmail].lastAssignedAt!)
    ) {
      teacherStatsMap[teacherEmail].lastAssignedAt = createdAt;
    }
  }

  const teacherSummaries = Object.entries(teacherStatsMap)
    .map(([email, stats]) => ({
      email,
      username: teacherNames[email] ?? email.split("@")[0] ?? "Teacher",
      classCount: stats.classIds.size,
      studentCount: stats.studentEmails.size,
      assignmentCount: stats.assignmentCount,
      lastAssignedAt: stats.lastAssignedAt,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({
    classSummaries,
    assignments: assignmentSummaries,
    studentSummaries,
    teacherSummaries,
  });
}
