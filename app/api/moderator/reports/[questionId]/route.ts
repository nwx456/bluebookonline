import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";
import { fetchQuestionReportDetail } from "@/lib/question-report-inbox";

type RouteContext = { params: Promise<{ questionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { questionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const examKindParam = searchParams.get("examKind");
    const examKind =
      examKindParam === "frq" || examKindParam === "mcq" ? examKindParam : undefined;
    const partLabel = searchParams.get("partLabel");
    const detail = await fetchQuestionReportDetail(questionId, {
      examKind,
      partLabel,
    });
    if (!detail) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    console.error("GET /api/moderator/reports/[questionId] error:", err);
    return NextResponse.json({ error: "Failed to load report detail." }, { status: 500 });
  }
}
