import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;
    const questionId = (body.questionId ?? body.question_id) as string | undefined;
    const partLabel = (body.partLabel ?? body.part_label ?? "") as string;
    const responseText = (body.responseText ?? body.response_text ?? "") as string;
    const isFlagged = body.isFlagged ?? body.is_flagged ?? false;

    if (!attemptId?.trim() || !questionId?.trim()) {
      return NextResponse.json(
        { error: "attemptId and questionId are required." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: attempt } = await supabase
      .from("frq_attempts")
      .select("id, status")
      .eq("id", attemptId.trim())
      .single();

    if (!attempt || attempt.status !== "in_progress") {
      return NextResponse.json({ error: "Attempt not found or already submitted." }, { status: 400 });
    }

    const label = String(partLabel ?? "").trim();
    const text = String(responseText ?? "");

    const { data: existing } = await supabase
      .from("frq_responses")
      .select("id")
      .eq("attempt_id", attemptId.trim())
      .eq("question_id", questionId.trim())
      .eq("part_label", label)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const { error } = await supabase
        .from("frq_responses")
        .update({
          response_text: text,
          is_flagged: !!isFlagged,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ error: "Failed to save response." }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("frq_responses").insert({
        attempt_id: attemptId.trim(),
        question_id: questionId.trim(),
        part_label: label,
        response_text: text,
        is_flagged: !!isFlagged,
        updated_at: now,
      });

      if (error) {
        return NextResponse.json({ error: "Failed to save response." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("frq answer error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save answer." },
      { status: 500 }
    );
  }
}
