import { NextRequest, NextResponse } from "next/server";
import {
  countClassAssignments,
  countClassMembers,
  generateUniqueClassCode,
} from "@/lib/class-server";
import { getInstitutionNamesByIds, isActiveInstitutionTeacher } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, description, class_code, institution_id, created_at, archived_at")
    .eq("teacher_email", teacherEmail)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("teacher/classes GET:", error);
    return NextResponse.json({ error: "Could not load classes." }, { status: 500 });
  }

  const classIds = (classes ?? []).map((c) => String(c.id));
  const institutionIds = [
    ...new Set(
      (classes ?? [])
        .map((c) => (c.institution_id ? String(c.institution_id) : null))
        .filter(Boolean) as string[]
    ),
  ];
  const [memberCounts, assignmentCounts, institutionNames] = await Promise.all([
    countClassMembers(supabase, classIds),
    countClassAssignments(supabase, classIds),
    getInstitutionNamesByIds(supabase, institutionIds),
  ]);

  return NextResponse.json({
    classes: (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      classCode: c.class_code,
      institutionId: c.institution_id,
      institutionName: c.institution_id
        ? institutionNames[String(c.institution_id)] ?? null
        : null,
      isIndependent: !c.institution_id,
      createdAt: c.created_at,
      memberCount: memberCounts[String(c.id)] ?? 0,
      assignmentCount: assignmentCounts[String(c.id)] ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const institutionIdRaw =
    typeof body.institutionId === "string" ? body.institutionId.trim() : null;
  const institutionId =
    institutionIdRaw && institutionIdRaw !== "independent" ? institutionIdRaw : null;

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Class name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);

  if (institutionId) {
    const isMember = await isActiveInstitutionTeacher(
      supabase,
      institutionId,
      teacherEmail
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "You must be an active member of the selected institution." },
        { status: 403 }
      );
    }
  }

  const classCode = await generateUniqueClassCode(supabase);
  if (!classCode) {
    return NextResponse.json(
      { error: "Could not generate a unique class code. Please try again." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({
      teacher_email: teacherEmail,
      name,
      description: description || null,
      class_code: classCode,
      institution_id: institutionId,
    })
    .select("id, name, description, class_code, institution_id, created_at")
    .single();

  if (error) {
    console.error("teacher/classes POST:", error);
    return NextResponse.json({ error: "Could not create class." }, { status: 500 });
  }

  let institutionName: string | null = null;
  if (data.institution_id) {
    const names = await getInstitutionNamesByIds(supabase, [String(data.institution_id)]);
    institutionName = names[String(data.institution_id)] ?? null;
  }

  return NextResponse.json({
    class: {
      id: data.id,
      name: data.name,
      description: data.description,
      classCode: data.class_code,
      institutionId: data.institution_id,
      institutionName,
      isIndependent: !data.institution_id,
      createdAt: data.created_at,
      memberCount: 0,
      assignmentCount: 0,
    },
  });
}
