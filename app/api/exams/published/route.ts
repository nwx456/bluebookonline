import { NextRequest, NextResponse } from "next/server";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { SUBJECT_KEYS, type SubjectKey } from "@/lib/subjects";
import { getExamProgram } from "@/lib/exam-program";
import { formatSourceAttribution } from "@/lib/exam-source";
import { getFrqExamDisplayName, getMcqExamDisplayName } from "@/lib/exam-display-name";

export type SubjectFilter = SubjectKey;

type FrqUploadRow = {
  id: string;
  title: string;
  display_title: string | null;
  course_id: string;
  user_email: string | null;
  created_at: string | null;
  question_count: number | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
};

/**
 * GET /api/exams/published?subject=AP_CSA&program=AP|SAT
 * Returns published MCQ and FRQ exams with owner username. Anonymous users can call this.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectRaw = searchParams.get("subject");
    const programRaw = (searchParams.get("program") || "").toUpperCase();
    const program = programRaw === "SAT" ? "SAT" : programRaw === "AP" ? "AP" : null;
    const subjectFilter =
      subjectRaw?.trim() && SUBJECT_KEYS.includes(subjectRaw as SubjectKey)
        ? subjectRaw.trim()
        : null;

    const supabase = createServerSupabaseAdmin();

    let mcqQuery = supabase
      .from("pdf_uploads")
      .select(
        "id, filename, display_title, subject, user_email, created_at, exam_program, sat_format, sat_adaptive_mode, source_type, source_name, source_url"
      )
      .eq("is_published", true)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false });

    if (subjectFilter) {
      mcqQuery = mcqQuery.eq("subject", subjectFilter);
    }

    if (program === "SAT") {
      mcqQuery = mcqQuery.eq("exam_program", "SAT");
    } else if (program === "AP") {
      mcqQuery = mcqQuery.or("exam_program.eq.AP,exam_program.is.null");
    }

    const includeFrq = program !== "SAT";

    let frqQuery = includeFrq
      ? supabase
          .from("frq_uploads")
          .select(
            "id, title, display_title, course_id, user_email, created_at, question_count, source_type, source_name, source_url"
          )
          .eq("status", "ready")
          .eq("is_published", true)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
      : null;

    if (frqQuery && subjectFilter) {
      frqQuery = frqQuery.eq("course_id", subjectFilter);
    }

    const [{ data: uploads, error: uploadsError }, frqResult] = await Promise.all([
      mcqQuery,
      frqQuery ? frqQuery : Promise.resolve({ data: [] as FrqUploadRow[], error: null }),
    ]);

    if (uploadsError) {
      console.error("Published exams fetch error:", uploadsError);
      return NextResponse.json(
        { error: "Failed to fetch published exams." },
        { status: 500 }
      );
    }

    if (frqResult.error) {
      console.error("Published FRQ exams fetch error:", frqResult.error);
      return NextResponse.json(
        { error: "Failed to fetch published exams." },
        { status: 500 }
      );
    }

    const uploadList = uploads ?? [];
    const frqList = (frqResult.data ?? []) as FrqUploadRow[];
    const emails = [
      ...new Set(
        [...uploadList, ...frqList].map((u) => u.user_email).filter(Boolean)
      ),
    ] as string[];

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

    const mcqResults = uploadList.map((u) => {
      const subjectVal = u.subject ?? "AP_CSA";
      const examProgram = (u.exam_program ?? getExamProgram(subjectVal)) as "AP" | "SAT";
      const attribution = formatSourceAttribution({
        source_type: u.source_type as string | null,
        source_name: u.source_name as string | null,
        source_url: u.source_url as string | null,
      });
      return {
        id: u.id,
        examKind: "mcq" as const,
        filename: getMcqExamDisplayName({
          displayTitle: (u as { display_title?: string | null }).display_title,
          filename: u.filename,
        }),
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

    const frqResults = frqList.map((u) => {
      const attribution = formatSourceAttribution({
        source_type: u.source_type as string | null,
        source_name: u.source_name as string | null,
        source_url: u.source_url as string | null,
      });
      return {
        id: u.id,
        examKind: "frq" as const,
        filename: getFrqExamDisplayName({
          displayTitle: u.display_title,
          title: u.title,
        }),
        subject: u.course_id,
        examProgram: "AP" as const,
        questionCount: u.question_count ?? 0,
        satFormat: null,
        satAdaptiveMode: null,
        ownerUsername: usernameMap[u.user_email ?? ""] ?? "Anonymous",
        createdAt: u.created_at,
        sourceType: u.source_type ?? null,
        sourceName: u.source_name ?? null,
        sourceUrl: u.source_url ?? null,
        sourceAttribution: attribution?.text ?? null,
      };
    });

    const result = [...mcqResults, ...frqResults].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json(
      { exams: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("Published exams error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
