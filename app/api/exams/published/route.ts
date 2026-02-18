import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const SUBJECTS = [
  "AP_CSA",
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
  "AP_PSYCHOLOGY",
  "AP_STATISTICS",
] as const;

export type SubjectFilter = (typeof SUBJECTS)[number];

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

    if (subjectRaw?.trim() && SUBJECTS.includes(subjectRaw as SubjectFilter)) {
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
    const { data: counts } = await supabase
      .from("questions")
      .select("upload_id")
      .in("upload_id", ids);
    const countByUpload: Record<string, number> = {};
    for (const c of counts ?? []) {
      const u = c.upload_id as string;
      countByUpload[u] = (countByUpload[u] ?? 0) + 1;
    }

    const result = uploadList.map((u) => ({
      id: u.id,
      filename: u.filename ?? "PDF",
      subject: u.subject ?? "AP_CSA",
      questionCount: countByUpload[u.id] ?? 0,
      ownerUsername: usernameMap[u.user_email] ?? "Anonymous",
      createdAt: u.created_at,
    }));

    return NextResponse.json({ exams: result });
  } catch (err) {
    console.error("Published exams error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
