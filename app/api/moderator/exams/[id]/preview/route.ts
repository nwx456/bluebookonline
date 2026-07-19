import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";
import {
  fetchModeratorFrqExamPreview,
  fetchModeratorMcqExamPreview,
} from "@/lib/moderator-exam-preview";
import { parseModeratorExamKind } from "@/lib/moderator-exam-utils";

/**
 * GET /api/moderator/exams/[id]/preview?examKind=mcq|frq&questionId=&partLabel=
 * Loads full exam context for moderator/admin exam-screen preview.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: uploadId } = await params;
    if (!uploadId?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const examKind = parseModeratorExamKind(searchParams.get("examKind"));
    const questionId = searchParams.get("questionId")?.trim() ?? "";
    const partLabel = searchParams.get("partLabel");

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required." }, { status: 400 });
    }

    if (examKind === "frq") {
      const result = await fetchModeratorFrqExamPreview(
        uploadId,
        questionId,
        partLabel?.trim() || null
      );
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ examKind: "frq", ...result });
    }

    const result = await fetchModeratorMcqExamPreview(uploadId, questionId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ examKind: "mcq", ...result });
  } catch (err) {
    console.error("GET /api/moderator/exams/[id]/preview error:", err);
    return NextResponse.json({ error: "Failed to load exam preview." }, { status: 500 });
  }
}
