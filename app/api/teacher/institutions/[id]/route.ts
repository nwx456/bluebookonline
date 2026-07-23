import { NextRequest, NextResponse } from "next/server";
import {
  countClassAssignments,
  countClassMembers,
} from "@/lib/class-server";
import { getInstitutionById, isActiveInstitutionTeacher } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: institutionId } = await params;
  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();

  const isMember = await isActiveInstitutionTeacher(
    supabase,
    institutionId,
    teacherEmail
  );
  if (!isMember) {
    return NextResponse.json(
      { error: "Institution not found or you are not an active member." },
      { status: 404 }
    );
  }

  const institution = await getInstitutionById(supabase, institutionId);
  if (!institution) {
    return NextResponse.json({ error: "Institution not found." }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("institution_teachers")
    .select("status, requested_at, approved_at")
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail)
    .maybeSingle();

  if (membershipError) {
    console.error("teacher/institutions/[id] GET membership:", membershipError);
    return NextResponse.json(
      { error: "Could not load institution membership." },
      { status: 500 }
    );
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, description, class_code, institution_id, created_at, archived_at")
    .eq("teacher_email", teacherEmail)
    .eq("institution_id", institutionId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (classesError) {
    console.error("teacher/institutions/[id] GET classes:", classesError);
    return NextResponse.json({ error: "Could not load classes." }, { status: 500 });
  }

  const classIds = (classes ?? []).map((c) => String(c.id));
  const [memberCounts, assignmentCounts] = await Promise.all([
    countClassMembers(supabase, classIds),
    countClassAssignments(supabase, classIds),
  ]);

  return NextResponse.json({
    institution: {
      id: institution.id,
      name: institution.name,
      status: institution.status,
      membershipStatus: membership?.status ?? "active",
      requestedAt: membership?.requested_at ?? null,
      approvedAt: membership?.approved_at ?? null,
    },
    classes: (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      classCode: c.class_code,
      institutionId: c.institution_id,
      institutionName: institution.name,
      isIndependent: false,
      createdAt: c.created_at,
      memberCount: memberCounts[String(c.id)] ?? 0,
      assignmentCount: assignmentCounts[String(c.id)] ?? 0,
    })),
  });
}
