import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import { createReportResolvedNotifications } from "@/lib/notifications";
import { fetchQuestionReportDetail } from "@/lib/question-report-inbox";
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
    const examKind =
      body.examKind === "frq" || body.examKind === "mcq" ? body.examKind : undefined;
    const partLabel =
      typeof body.partLabel === "string" ? body.partLabel : body.partLabel === null ? null : undefined;
    const moderatorEmail = normalizeEmail(auth.user!.email!);
    const supabase = createServerSupabaseAdmin();

    const detail = await fetchQuestionReportDetail(questionId, {
      examKind,
      partLabel,
    });
    if (!detail?.summary) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const reporterEmails = detail.reporters.map((r) => r.userEmail);
    const examName = detail.summary.exam.filename;
    const questionNumber = detail.summary.questionNumber;
    const uploadId = detail.summary.uploadId;

    const count = await createReportResolvedNotifications({
      reporters: reporterEmails,
      questionId,
      questionNumber,
      examName,
      uploadId,
    });

    await supabase.from("question_report_actions").insert({
      question_id: questionId,
      action: "notify",
      moderator_email: moderatorEmail,
      note: `Notified ${count} reporter(s).`,
    });

    return NextResponse.json({ ok: true, notified: count });
  } catch (err) {
    console.error("POST notify error:", err);
    return NextResponse.json({ error: "Failed to notify reporters." }, { status: 500 });
  }
}
