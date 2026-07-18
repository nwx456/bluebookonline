import { NextRequest, NextResponse } from "next/server";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";
import { getExamProgram } from "@/lib/exam-program";
import { formatSourceAttribution } from "@/lib/exam-source";

export type SubjectFilter = SubjectKey;

/**
 * GET /api/exams/published?subject=AP_CSA&program=AP|SAT
 * Returns published exams with owner username. Anonymous users can call this.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectRaw = searchParams.get("subject");
    const programRaw = (searchParams.get("program") || "").toUpperCase();
    const program = programRaw === "SAT" ? "SAT" : programRaw === "AP" ? "AP" : null;

    const supabase = createServerSupabaseAdmin();

    let query = supabase
      .from("pdf_uploads")
      .select(
        "id, filename, subject, user_email, created_at, exam_program, sat_format, sat_adaptive_mode, source_type, source_name, source_url"
      )
      .eq("is_published", true)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false });

    if (subjectRaw?.trim() && SUBJECT_KEYS.includes(subjectRaw as SubjectKey)) {
      query = query.eq("subject", subjectRaw.trim());
    }

    if (program === "SAT") {
      query = query.eq("exam_program", "SAT");
    } else if (program === "AP") {
      query = query.or("exam_program.eq.AP,exam_program.is.null");
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

    const result = uploadList.map((u) => {
      const subjectVal = u.subject ?? "AP_CSA";
      const examProgram = (u.exam_program ?? getExamProgram(subjectVal)) as "AP" | "SAT";
      const attribution = formatSourceAttribution({
        source_type: u.source_type as string | null,
        source_name: u.source_name as string | null,
        source_url: u.source_url as string | null,
      });
      return {
        id: u.id,
        filename: u.filename ?? "PDF",
        subject: subjectVal,
        examProgram,
        questionCount: countByUpload[u.id] ?? 0,
        satFormat: (u as { sat_format?: string | null }).sat_format ?? null,
        satAdaptiveMode:
          (u as { sat_adaptive_mode?: string | null }).sat_adaptive_mode ?? null,
        ownerUsername: usernameMap[u.user_email] ?? "Anonymous",
        createdAt: u.created_at,
        sourceType: u.source_type ?? null,
        sourceName: u.source_name ?? null,
        sourceUrl: u.source_url ?? null,
        sourceAttribution: attribution?.text ?? null,
      };
    });

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
