import { NextRequest, NextResponse } from "next/server";
import { normalizeDisplayTitleInput } from "@/lib/exam-display-name";
import { requireModeratorUser } from "@/lib/moderator-auth";
import {
  moderatorUploadTable,
  parseModeratorExamKind,
} from "@/lib/moderator-exam-utils";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/moderator/exams/[id]/title?examKind=mcq|frq
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Exam ID is required." }, { status: 400 });
    }

    const examKind = parseModeratorExamKind(new URL(request.url).searchParams.get("examKind"));
    const table = moderatorUploadTable(examKind);
    const body = await request.json().catch(() => ({}));

    let displayTitle: string | null;
    try {
      displayTitle = normalizeDisplayTitleInput(body.displayTitle);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid display title." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({ display_title: displayTitle })
      .eq("id", id);

    if (updateError) {
      console.error("moderator/exams title PATCH:", updateError);
      return NextResponse.json({ error: "Could not update display title." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, displayTitle });
  } catch (err) {
    console.error("PATCH /api/moderator/exams/[id]/title:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
