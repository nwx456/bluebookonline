import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/** GET /api/resources/published — public approved teacher resources */
export async function GET() {
  const supabase = createServerSupabaseAdmin();

  const { data: resources, error } = await supabase
    .from("teacher_resources")
    .select(
      "id, title, description, resource_type, file_name, external_url, teacher_email, created_at"
    )
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load resources." }, { status: 500 });
  }

  const emails = [...new Set((resources ?? []).map((r) => r.teacher_email).filter(Boolean))];
  let usernameMap: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", emails);
    usernameMap = Object.fromEntries(
      (users ?? []).map((u) => [
        normalizeEmail(u.email as string),
        (u.username as string | null)?.trim() || "Teacher",
      ])
    );
  }

  return NextResponse.json({
    resources: (resources ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      resourceType: r.resource_type,
      fileName: r.file_name,
      externalUrl: r.external_url,
      teacherUsername: usernameMap[normalizeEmail(r.teacher_email as string)] ?? "Teacher",
      createdAt: r.created_at,
    })),
  });
}
