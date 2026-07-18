import { NextRequest, NextResponse } from "next/server";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { getExamProgram } from "@/lib/exam-program";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { requireModeratorUser } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { sourceTypeShortLabel, type ExamSourceType } from "@/lib/exam-source";

type UploadRow = {
  id: string;
  filename: string | null;
  subject: string | null;
  user_email: string | null;
  created_at: string | null;
  exam_program: string | null;
  is_published: boolean | null;
  moderation_status: string | null;
  publish_requested_at: string | null;
  storage_path: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
};

type FrqUploadRow = {
  id: string;
  title: string;
  display_title: string | null;
  course_id: string;
  user_email: string | null;
  created_at: string | null;
  question_count: number | null;
  is_published: boolean | null;
  moderation_status: string | null;
  publish_requested_at: string | null;
  storage_path: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
};

async function mapUploadsToExamRows(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  uploadList: UploadRow[]
) {
  const emails = [...new Set(uploadList.map((u) => u.user_email).filter(Boolean))] as string[];

  let usernameMap: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", emails);
    usernameMap = Object.fromEntries(
      (users ?? []).map((u) => [
        String(u.email ?? "").trim().toLowerCase(),
        (u.username as string | null)?.trim() || "Anonymous",
      ])
    );
  }

  const ids = uploadList.map((u) => u.id);
  const countByUpload = await countQuestionsByUploadIds(supabase, ids);

  return uploadList.map((u) => {
    const subjectVal = (u.subject ?? "AP_CSA") as SubjectKey;
    const userEmail = String(u.user_email ?? "").trim().toLowerCase();
    return {
      id: u.id,
      examKind: "mcq" as const,
      filename: u.filename ?? "PDF",
      subject: subjectVal,
      subjectLabel: SUBJECT_LABELS[subjectVal] ?? subjectVal,
      examProgram: (u.exam_program ?? getExamProgram(subjectVal)) as "AP" | "SAT",
      userEmail,
      username: usernameMap[userEmail] ?? "Anonymous",
      questionCount: countByUpload[u.id] ?? 0,
      isPublished: u.is_published === true,
      moderationStatus: u.moderation_status ?? "draft",
      publishRequestedAt: u.publish_requested_at,
      createdAt: u.created_at,
      hasStoragePath: Boolean(u.storage_path && u.storage_path.endsWith(".pdf")),
      sourceType: u.source_type ?? null,
      sourceTypeLabel:
        u.source_type && ["book", "agency", "school"].includes(u.source_type)
          ? sourceTypeShortLabel(u.source_type as ExamSourceType)
          : null,
      sourceName: u.source_name ?? null,
      sourceUrl: u.source_url ?? null,
    };
  });
}

async function mapFrqUploadsToExamRows(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  uploadList: FrqUploadRow[]
) {
  const emails = [...new Set(uploadList.map((u) => u.user_email).filter(Boolean))] as string[];

  let usernameMap: Record<string, string> = {};
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", emails);
    usernameMap = Object.fromEntries(
      (users ?? []).map((u) => [
        String(u.email ?? "").trim().toLowerCase(),
        (u.username as string | null)?.trim() || "Anonymous",
      ])
    );
  }

  return uploadList.map((u) => {
    const userEmail = String(u.user_email ?? "").trim().toLowerCase();
    const title = (u.display_title ?? u.title ?? "FRQ Exam").trim();
    return {
      id: u.id,
      examKind: "frq" as const,
      filename: title,
      subject: u.course_id,
      subjectLabel: getFrqCourseLabel(u.course_id),
      examProgram: "AP" as const,
      userEmail,
      username: usernameMap[userEmail] ?? "Anonymous",
      questionCount: u.question_count ?? 0,
      isPublished: u.is_published === true,
      moderationStatus: u.moderation_status ?? "draft",
      publishRequestedAt: u.publish_requested_at,
      createdAt: u.created_at,
      hasStoragePath: Boolean(u.storage_path && u.storage_path.endsWith(".pdf")),
      sourceType: u.source_type ?? null,
      sourceTypeLabel:
        u.source_type && ["book", "agency", "school"].includes(u.source_type)
          ? sourceTypeShortLabel(u.source_type as ExamSourceType)
          : null,
      sourceName: u.source_name ?? null,
      sourceUrl: u.source_url ?? null,
    };
  });
}

/**
 * GET /api/moderator/exams?status=pending|published
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireModeratorUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim() ?? "pending";

    const supabase = createServerSupabaseAdmin();

    let mcqQuery = supabase
      .from("pdf_uploads")
      .select(
        "id, filename, subject, user_email, created_at, exam_program, is_published, moderation_status, publish_requested_at, storage_path, source_type, source_name, source_url"
      )
      .order("created_at", { ascending: false });

    if (status === "published") {
      mcqQuery = mcqQuery.eq("is_published", true).eq("moderation_status", "approved");
    } else {
      mcqQuery = mcqQuery.eq("moderation_status", "pending_review");
    }

    let frqQuery = supabase
      .from("frq_uploads")
      .select(
        "id, title, display_title, course_id, user_email, created_at, question_count, is_published, moderation_status, publish_requested_at, storage_path, source_type, source_name, source_url"
      )
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (status === "published") {
      frqQuery = frqQuery.eq("is_published", true).eq("moderation_status", "approved");
    } else {
      frqQuery = frqQuery.eq("moderation_status", "pending_review");
    }

    const [{ data: mcqUploads, error: mcqError }, { data: frqUploads, error: frqError }] =
      await Promise.all([mcqQuery, frqQuery]);

    if (mcqError || frqError) {
      console.error("moderator/exams list:", mcqError ?? frqError);
      return NextResponse.json({ error: "Could not load exams." }, { status: 500 });
    }

    const [mcqExams, frqExams] = await Promise.all([
      mapUploadsToExamRows(supabase, (mcqUploads ?? []) as UploadRow[]),
      mapFrqUploadsToExamRows(supabase, (frqUploads ?? []) as FrqUploadRow[]),
    ]);

    const exams = [...mcqExams, ...frqExams].sort((a, b) => {
      const aTime = new Date(a.publishRequestedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.publishRequestedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json(
      { exams, status },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("moderator/exams GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
