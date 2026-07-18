import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/moderator/resources?status=pending|published
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireModeratorUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim() ?? "pending";

    const supabase = createServerSupabaseAdmin();
    let query = supabase
      .from("teacher_resources")
      .select(
        "id, title, description, resource_type, file_name, external_url, visibility, moderation_status, teacher_email, created_at"
      )
      .eq("visibility", "public")
      .order("created_at", { ascending: false });

    if (status === "published") {
      query = query.eq("moderation_status", "approved");
    } else {
      query = query.eq("moderation_status", "pending_review");
    }

    const { data: resources, error } = await query;

    if (error) {
      console.error("moderator/resources list:", error);
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
        moderationStatus: r.moderation_status,
        teacherEmail: normalizeEmail(r.teacher_email as string),
        teacherUsername: usernameMap[normalizeEmail(r.teacher_email as string)] ?? "Teacher",
        createdAt: r.created_at,
      })),
      status,
    });
  } catch (e) {
    console.error("moderator/resources GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
