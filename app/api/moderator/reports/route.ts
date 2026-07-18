import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";
import {
  fetchQuestionReportInbox,
  type ReportStatusFilter,
} from "@/lib/question-report-inbox";

export async function GET(request: NextRequest) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") ?? "open";
    const status: ReportStatusFilter =
      statusParam === "dismissed" || statusParam === "all" ? statusParam : "open";
    const limit = Number(searchParams.get("limit") ?? "50");
    const offset = Number(searchParams.get("offset") ?? "0");

    const result = await fetchQuestionReportInbox({ status, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/moderator/reports error:", err);
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}
