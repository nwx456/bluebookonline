import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { countClassAssignments, countClassMembers } from "@/lib/class-server";
import { getInstitutionNamesByIds } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  const studentEmail = normalizeEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: memberships, error } = await supabase
    .from("class_members")
    .select("class_id, joined_at")
    .eq("student_email", studentEmail)
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("student/classes GET:", error);
    return NextResponse.json({ error: "Could not load classes." }, { status: 500 });
  }

  const classIds = (memberships ?? []).map((m) => String(m.class_id));
  if (classIds.length === 0) {
    return NextResponse.json({ classes: [] });
  }

  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("id, name, description, class_code, teacher_email, institution_id, archived_at")
    .in("id", classIds)
    .is("archived_at", null);

  if (classError) {
    return NextResponse.json({ error: "Could not load classes." }, { status: 500 });
  }

  const classMap = Object.fromEntries((classRows ?? []).map((c) => [String(c.id), c]));
  const activeMemberships = (memberships ?? []).filter((m) => classMap[String(m.class_id)]);

  const activeClassIds = activeMemberships.map((m) => String(m.class_id));
  const institutionIds = [
    ...new Set(
      activeClassIds
        .map((id) => {
          const instId = classMap[id]?.institution_id;
          return instId ? String(instId) : null;
        })
        .filter(Boolean) as string[]
    ),
  ];
  const [memberCounts, assignmentCounts, institutionNames] = await Promise.all([
    countClassMembers(supabase, activeClassIds),
    countClassAssignments(supabase, activeClassIds),
    getInstitutionNamesByIds(supabase, institutionIds),
  ]);

  const teacherEmails = [
    ...new Set(
      activeClassIds.map((id) =>
        normalizeEmail(classMap[id]?.teacher_email as string)
      )
    ),
  ];
  const { data: teachers } = await supabase
    .from("usertable")
    .select("email, username")
    .in("email", teacherEmails.length ? teacherEmails : ["__none__"]);

  const teacherNames = Object.fromEntries(
    (teachers ?? []).map((t) => [
      normalizeEmail(t.email as string),
      (t.username as string | null)?.trim() || t.email?.split("@")[0] || "Teacher",
    ])
  );

  return NextResponse.json({
    classes: activeMemberships.map((m) => {
      const cls = classMap[String(m.class_id)]!;
      const teacherEmail = normalizeEmail(cls.teacher_email as string);
      return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        classCode: cls.class_code,
        teacherEmail,
        teacherName: teacherNames[teacherEmail] ?? "Teacher",
        institutionId: cls.institution_id,
        institutionName: cls.institution_id
          ? institutionNames[String(cls.institution_id)] ?? null
          : null,
        isIndependent: !cls.institution_id,
        joinedAt: m.joined_at,
        memberCount: memberCounts[String(cls.id)] ?? 0,
        assignmentCount: assignmentCounts[String(cls.id)] ?? 0,
      };
    }),
  });
}
