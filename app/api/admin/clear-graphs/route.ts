import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const GRAPHS_BUCKET = "exam-graphs";

/**
 * POST /api/admin/clear-graphs – One-time cleanup of all exam-graphs storage objects.
 * Requires header X-Clear-Graphs-Secret matching CLEAR_GRAPHS_SECRET env var.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-clear-graphs-secret");
    const expected = process.env.CLEAR_GRAPHS_SECRET;
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseAdmin();

    const { data: uploads } = await supabase.from("pdf_uploads").select("id");
    const uploadIds = (uploads ?? []).map((u) => u.id);

    let removedCount = 0;
    for (const uploadId of uploadIds) {
      const { data: files } = await supabase.storage
        .from(GRAPHS_BUCKET)
        .list(uploadId);
      if (files?.length) {
        const paths = files.map((f) => `${uploadId}/${f.name}`);
        await supabase.storage.from(GRAPHS_BUCKET).remove(paths);
        removedCount += paths.length;
      }
    }

    return NextResponse.json({ removed: removedCount });
  } catch (err) {
    console.error("Clear graphs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed." },
      { status: 500 }
    );
  }
}
