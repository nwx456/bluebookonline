import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createSignedPdfUrl } from "@/lib/signed-pdf-url";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/pdfs/[id]/url
 * Signed PDF URL for admin preview/download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: uploadId } = await params;
    if (!uploadId?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, filename, storage_path")
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

    return NextResponse.json({
      url,
      filename: (upload.filename as string | null) ?? "exam.pdf",
    });
  } catch (e) {
    console.error("admin/pdfs/url:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
