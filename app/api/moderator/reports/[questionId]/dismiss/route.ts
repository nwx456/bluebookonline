import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import {
  dismissQuestionReports,
  type ExamKind,
} from "@/lib/question-report-inbox";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { questionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : null;
    const examKind =
      body.examKind === "frq" || body.examKind === "mcq"
        ? (body.examKind as ExamKind)
        : undefined;
    const partLabel =
      typeof body.partLabel === "string" ? body.partLabel : body.partLabel === null ? null : undefined;
    const moderatorEmail = normalizeEmail(auth.user!.email!);

    const result = await dismissQuestionReports({
      questionId,
      examKind,
      partLabel,
    });

    if ("error" in result) {
      const status = result.error === "No open reports to dismiss." ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    const supabase = createServerSupabaseAdmin();
    await supabase.from("question_report_actions").insert({
      question_id: questionId,
      action: "dismiss",
      moderator_email: moderatorEmail,
      note,
    });

    return NextResponse.json({ ok: true, dismissed: result.dismissed });
  } catch (err) {
    console.error("POST dismiss error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
