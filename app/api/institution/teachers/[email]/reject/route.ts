import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
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

  const { error } = await supabase
    .from("institution_teachers")
    .delete()
    .eq("institution_id", auth.institution!.id)
    .eq("teacher_email", teacherEmail)
    .eq("status", "pending");

  if (error) {
    console.error("institution/teachers reject:", error);
    return NextResponse.json({ error: "Could not reject request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: teacherEmail });
}
