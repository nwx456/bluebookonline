import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import {
  moderatorUploadTable,
  parseModeratorExamKind,
} from "@/lib/moderator-exam-utils";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/moderator/exams/[id]/reject?examKind=frq
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireModeratorUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: uploadId } = await params;
    if (!uploadId?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const examKind = parseModeratorExamKind(new URL(request.url).searchParams.get("examKind"));
    const table = moderatorUploadTable(examKind);

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from(table)
      .select("id, moderation_status")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    if (upload.moderation_status !== "pending_review") {
      return NextResponse.json(
        { error: "This exam is not awaiting review." },
        { status: 409 }
      );
    }

    const moderatorEmail = normalizeEmail(auth.user.email);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from(table)
      .update({
        is_published: false,
        moderation_status: "rejected",
        moderated_at: now,
        moderated_by: moderatorEmail,
      })
      .eq("id", uploadId);

    if (updateError) {
      console.error("moderator reject:", updateError);
      return NextResponse.json({ error: "Could not reject exam." }, { status: 500 });
    }

    return NextResponse.json({ success: true, moderationStatus: "rejected" });
  } catch (e) {
    console.error("moderator/exams reject:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
