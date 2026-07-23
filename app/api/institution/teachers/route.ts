import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const institutionId = auth.institution!.id;
  const supabase = createServerSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("institution_teachers")
    .select("teacher_email, status, requested_at, approved_at, removed_at")
    .eq("institution_id", institutionId)
    .order("requested_at", { ascending: false });

  if (error) {
    console.error("institution/teachers GET:", error);
    return NextResponse.json({ error: "Could not load teachers." }, { status: 500 });
  }

  const emails = (rows ?? []).map((r) => normalizeEmail(r.teacher_email as string));
  const { data: users } = await supabase
    .from("usertable")
    .select("email, username")
    .in("email", emails.length ? emails : ["__none__"]);

  const nameMap = Object.fromEntries(
    (users ?? []).map((u) => [
      normalizeEmail(u.email as string),
      (u.username as string | null)?.trim() || u.email?.split("@")[0] || "Teacher",
    ])
  );

  return NextResponse.json({
    teachers: (rows ?? []).map((row) => {
      const email = normalizeEmail(row.teacher_email as string);
      return {
        email,
        username: nameMap[email] ?? email.split("@")[0],
        status: row.status,
        requestedAt: row.requested_at,
        approvedAt: row.approved_at,
        removedAt: row.removed_at,
      };
    }),
  });
}
