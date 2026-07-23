import { NextRequest, NextResponse } from "next/server";
import { countClassMembers } from "@/lib/class-server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { isActiveInstitutionTeacher } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const institutionId = auth.institution!.id;
  const supabase = createServerSupabaseAdmin();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, description, class_code, teacher_email, created_at")
    .eq("institution_id", institutionId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("institution/classes GET:", error);
    return NextResponse.json({ error: "Could not load classes." }, { status: 500 });
  }

  const classIds = (classes ?? []).map((c) => String(c.id));
  const memberCounts = await countClassMembers(supabase, classIds);

  const teacherEmails = [
    ...new Set((classes ?? []).map((c) => normalizeEmail(c.teacher_email as string))),
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
    classes: (classes ?? []).map((cls) => {
      const teacherEmail = normalizeEmail(cls.teacher_email as string);
      return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        classCode: cls.class_code,
        teacherEmail,
        teacherName: teacherNames[teacherEmail] ?? "Teacher",
        memberCount: memberCounts[String(cls.id)] ?? 0,
        createdAt: cls.created_at,
      };
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";
  const newTeacherEmail = normalizeEmail(body.teacherEmail as string);

  if (!classId || !newTeacherEmail) {
    return NextResponse.json(
      { error: "Class ID and teacher email are required." },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseAdmin();
  const institutionId = auth.institution!.id;

  const { data: cls } = await supabase
    .from("classes")
    .select("id, institution_id")
    .eq("id", classId)
    .eq("institution_id", institutionId)
    .is("archived_at", null)
    .maybeSingle();

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const isMember = await isActiveInstitutionTeacher(
    supabase,
    institutionId,
    newTeacherEmail
  );
  if (!isMember) {
    return NextResponse.json(
      { error: "The selected teacher is not an active member of this institution." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("classes")
    .update({ teacher_email: newTeacherEmail })
    .eq("id", classId);

  if (error) {
    console.error("institution/classes PATCH:", error);
    return NextResponse.json({ error: "Could not reassign teacher." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, classId, teacherEmail: newTeacherEmail });
}
