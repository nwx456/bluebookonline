import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ email: string }> };

async function setTeacherStatus(
  request: NextRequest,
  emailParam: string,
  status: "active" | "removed"
) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const teacherEmail = normalizeEmail(decodeURIComponent(emailParam));
  if (!teacherEmail) {
    return NextResponse.json({ error: "Valid teacher email is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const institutionId = auth.institution!.id;

  const { data: existing } = await supabase
    .from("institution_teachers")
    .select("status")
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Teacher membership not found." }, { status: 404 });
  }

  if (status === "active" && existing.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending requests can be approved." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { status };
  if (status === "active") {
    updates.approved_at = new Date().toISOString();
    updates.removed_at = null;
  } else {
    updates.removed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("institution_teachers")
    .update(updates)
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail);

  if (error) {
    console.error(`institution/teachers/${status}:`, error);
    return NextResponse.json({ error: "Could not update teacher." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: teacherEmail, status });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { email } = await params;
  return setTeacherStatus(request, email, "active");
}
