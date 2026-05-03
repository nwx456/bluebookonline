import { NextRequest, NextResponse } from "next/server";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";

export type SubjectFilter = SubjectKey;

/**
 * GET /api/exams/published?subject=AP_CSA
 * Returns published exams with owner username. Anonymous users can call this.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectRaw = searchParams.get("subject");

    const supabase = createServerSupabaseAdmin();

    let query = supabase
      .from("pdf_uploads")
      .select("id, filename, subject, user_email, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (subjectRaw?.trim() && SUBJECT_KEYS.includes(subjectRaw as SubjectKey)) {
      query = query.eq("subject", subjectRaw.trim());
    }

    const { data: uploads, error: uploadsError } = await query;

    if (uploadsError) {
      console.error("Published exams fetch error:", uploadsError);
      return NextResponse.json(
        { error: "Failed to fetch published exams." },
        { status: 500 }
      );
    }

    const uploadList = uploads ?? [];
    const emails = [...new Set(uploadList.map((u) => u.user_email).filter(Boolean))] as string[];

    let usernameMap: Record<string, string> = {};
    if (emails.length > 0) {
      const { data: users } = await supabase
        .from("usertable")
        .select("email, username")
        .in("email", emails);
      usernameMap = Object.fromEntries(
        (users ?? []).map((u) => [
          u.email,
          u.username?.trim() || "Anonymous",
        ])
      );
    }

    const ids = uploadList.map((u) => u.id);
    const countByUpload = await countQuestionsByUploadIds(supabase, ids);

    const result = uploadList.map((u) => ({
      id: u.id,
      filename: u.filename ?? "PDF",
      subject: u.subject ?? "AP_CSA",
      questionCount: countByUpload[u.id] ?? 0,
      ownerUsername: usernameMap[u.user_email] ?? "Anonymous",
      createdAt: u.created_at,
    }));

    return NextResponse.json(
      { exams: result },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    console.error("Published exams error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
