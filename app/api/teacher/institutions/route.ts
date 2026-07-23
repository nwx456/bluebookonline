import { NextRequest, NextResponse } from "next/server";
import { findInstitutionByJoinCode } from "@/lib/institution-server";
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

  const { data: memberships, error } = await supabase
    .from("institution_teachers")
    .select("institution_id, status, requested_at, approved_at")
    .eq("teacher_email", teacherEmail)
    .order("requested_at", { ascending: false });

  if (error) {
    console.error("teacher/institutions GET:", error);
    return NextResponse.json({ error: "Could not load institutions." }, { status: 500 });
  }

  const institutionIds = (memberships ?? []).map((m) => String(m.institution_id));
  const { data: institutions } = await supabase
    .from("institutions")
    .select("id, name, status")
    .in("id", institutionIds.length ? institutionIds : ["00000000-0000-0000-0000-000000000000"]);

  const instMap = Object.fromEntries(
    (institutions ?? []).map((i) => [String(i.id), i])
  );

  return NextResponse.json({
    institutions: (memberships ?? []).map((m) => {
      const inst = instMap[String(m.institution_id)];
      return {
        id: m.institution_id,
        name: inst?.name ?? "Institution",
        institutionStatus: inst?.status ?? "active",
        membershipStatus: m.status,
        requestedAt: m.requested_at,
        approvedAt: m.approved_at,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const joinCode = typeof body.joinCode === "string" ? body.joinCode.trim() : "";
  if (!joinCode) {
    return NextResponse.json({ error: "Join code is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const institution = await findInstitutionByJoinCode(supabase, joinCode);

  if (!institution) {
    return NextResponse.json({ error: "Invalid join code." }, { status: 404 });
  }

  if (institution.status === "suspended") {
    return NextResponse.json(
      { error: "This institution is not accepting new members." },
      { status: 403 }
    );
  }

  const teacherEmail = normalizeEmail(auth.user!.email);

  const { data: existing } = await supabase
    .from("institution_teachers")
    .select("status")
    .eq("institution_id", institution.id)
    .eq("teacher_email", teacherEmail)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json(
      { error: "You are already a member of this institution." },
      { status: 409 }
    );
  }

  if (existing?.status === "pending") {
    return NextResponse.json(
      { error: "Your join request is already pending approval." },
      { status: 409 }
    );
  }

  if (existing?.status === "removed") {
    const { error: updateError } = await supabase
      .from("institution_teachers")
      .update({
        status: "pending",
        requested_at: new Date().toISOString(),
        approved_at: null,
        removed_at: null,
      })
      .eq("institution_id", institution.id)
      .eq("teacher_email", teacherEmail);

    if (updateError) {
      console.error("teacher/institutions join re-request:", updateError);
      return NextResponse.json({ error: "Could not submit join request." }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase.from("institution_teachers").insert({
      institution_id: institution.id,
      teacher_email: teacherEmail,
      status: "pending",
    });

    if (insertError) {
      console.error("teacher/institutions join:", insertError);
      return NextResponse.json({ error: "Could not submit join request." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    institution: {
      id: institution.id,
      name: institution.name,
      membershipStatus: "pending",
    },
  });
}
