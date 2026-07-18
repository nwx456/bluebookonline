import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";
import {
  moderatorUploadTable,
  parseModeratorExamKind,
} from "@/lib/moderator-exam-utils";
import { createSignedPdfUrl } from "@/lib/signed-pdf-url";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/moderator/exams/[id]/url?examKind=frq — Signed PDF URL for moderator preview.
 */
export async function GET(
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
    const selectFields =
      examKind === "frq" ? "id, title, storage_path" : "id, filename, storage_path";

    const { data: upload, error: fetchError } = await supabase
      .from(table)
      .select(selectFields)
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const { url, error } = await createSignedPdfUrl(
      supabase,
      uploadId,
      upload.storage_path as string | null
    );

    if (error || !url) {
      return NextResponse.json({ error: error ?? "Could not generate PDF link." }, { status: 404 });
    }

    const filename =
      examKind === "frq"
        ? `${((upload as { title?: string }).title ?? "frq-exam").trim()}.pdf`
        : ((upload as { filename?: string | null }).filename as string | null) ?? "exam.pdf";

    return NextResponse.json({
      url,
      filename,
    });
  } catch (e) {
    console.error("moderator/exams/url:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
