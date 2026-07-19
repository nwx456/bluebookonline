import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, requireModeratorUser } from "@/lib/moderator-auth";
import { hardDeleteReportedQuestion } from "@/lib/question-report-inbox";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { questionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : undefined;
    const examKind =
      body.examKind === "frq" || body.examKind === "mcq" ? body.examKind : null;
    if (!examKind) {
      return NextResponse.json({ error: "examKind is required (mcq or frq)." }, { status: 400 });
    }
    const partLabel =
      typeof body.partLabel === "string" ? body.partLabel : body.partLabel === null ? null : undefined;
    const moderatorEmail = normalizeEmail(auth.user!.email!);

    const result = await hardDeleteReportedQuestion({
      questionId,
      moderatorEmail,
      note,
      examKind,
      partLabel,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST delete error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
