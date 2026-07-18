import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireModeratorUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: resourceId } = await params;
    const supabase = createServerSupabaseAdmin();

    const { data: resource, error: fetchError } = await supabase
      .from("teacher_resources")
      .select("id, moderation_status, visibility")
      .eq("id", resourceId)
      .single();

    if (fetchError || !resource) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (resource.moderation_status !== "pending_review") {
      return NextResponse.json(
        { error: "This resource is not awaiting review." },
        { status: 409 }
      );
    }

    const moderatorEmail = normalizeEmail(auth.user!.email);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("teacher_resources")
      .update({
        moderation_status: "approved",
        moderated_at: now,
        moderated_by: moderatorEmail,
      })
      .eq("id", resourceId);

    if (updateError) {
      return NextResponse.json({ error: "Could not approve resource." }, { status: 500 });
    }

    return NextResponse.json({ success: true, moderationStatus: "approved" });
  } catch (e) {
    console.error("moderator/resources approve:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
