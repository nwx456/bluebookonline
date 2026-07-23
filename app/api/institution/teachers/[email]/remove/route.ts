import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { isActiveInstitutionTeacher } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ email: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { email } = await params;
  const teacherEmail = normalizeEmail(decodeURIComponent(email));
  const supabase = createServerSupabaseAdmin();
  const institutionId = auth.institution!.id;

  const { data: existing } = await supabase
    .from("institution_teachers")
    .select("status")
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail)
    .maybeSingle();

  if (!existing || existing.status !== "active") {
    return NextResponse.json({ error: "Active teacher membership not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("institution_teachers")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("institution_id", institutionId)
    .eq("teacher_email", teacherEmail);

  if (error) {
    console.error("institution/teachers remove:", error);
    return NextResponse.json({ error: "Could not remove teacher." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: teacherEmail, status: "removed" });
}
