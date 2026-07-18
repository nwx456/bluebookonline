import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { isClassMember } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { user, error: authError } = await getAuthUser(_request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const studentEmail = normalizeEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const member = await isClassMember(supabase, id, studentEmail);
  if (!member) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", id)
    .eq("student_email", studentEmail);

  if (error) {
    return NextResponse.json({ error: "Could not leave class." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
