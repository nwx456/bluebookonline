import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";
import { updateAdminExamSource } from "@/lib/exam-source-admin";
import { parseModeratorExamKind } from "@/lib/moderator-exam-utils";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/moderator/exams/[id]/source?examKind=mcq|frq
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
    const body = await request.json().catch(() => ({}));
    const result = await updateAdminExamSource({ examId: id, examKind, body });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      sourceType: result.source.sourceType,
      sourceName: result.source.sourceName,
      sourceUrl: result.source.sourceUrl,
    });
  } catch (err) {
    console.error("PATCH /api/moderator/exams/[id]/source:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
