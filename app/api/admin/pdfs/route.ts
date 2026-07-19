import { NextRequest, NextResponse } from "next/server";
import { getAnswerKeyLabel } from "@/lib/answer-key-label";
import { resolveRequestedQuestionCount } from "@/lib/infer-requested-question-count";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { getExamProgram } from "@/lib/exam-program";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { canAdminEditExamSource, examHasSource } from "@/lib/exam-source-admin";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
  requested_question_count: number | null;
  answer_key_from_pdf_count: number | null;
  source_type: string | null;
  source_name: string | null;
  source_url: string | null;
};

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

async function resolveUserEmails(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  term: string
): Promise<string[]> {
  const escaped = escapeIlike(term.trim());
  if (!escaped) return [];

  const { data: rows, error } = await supabase
    .from("usertable")
    .select("email")
    .or(`email.ilike.%${escaped}%,username.ilike.%${escaped}%`);

  if (error) {
    console.error("admin/pdfs user lookup:", error);
    return [];
  }

  return [...new Set((rows ?? []).map((r) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean))];
}

function isQuestionCountMismatch(requested: number | null, extracted: number): boolean {
  return requested != null && requested !== extracted;
}

async function mapUploadsToPdfRows(
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
    const storagePath = u.storage_path;
    const questionCount = countByUpload[u.id] ?? 0;
    const requestedResolved = resolveRequestedQuestionCount({
      stored: u.requested_question_count,
      filename: String(u.filename ?? ""),
    });
    const requestedQuestionCount = requestedResolved.value;
    const requestedQuestionCountSource = requestedResolved.source;
    const answerKeyFromPdfCount =
      u.answer_key_from_pdf_count != null && Number.isFinite(Number(u.answer_key_from_pdf_count))
        ? Number(u.answer_key_from_pdf_count)
        : null;
    const answerKey = getAnswerKeyLabel(answerKeyFromPdfCount, questionCount);
    const questionCountMismatch = isQuestionCountMismatch(requestedQuestionCount, questionCount);

    return {
      id: u.id,
      filename: u.filename ?? "PDF",
      subject: subjectVal,
      subjectLabel: SUBJECT_LABELS[subjectVal] ?? subjectVal,
      examProgram: (u.exam_program ?? getExamProgram(subjectVal)) as "AP" | "SAT",
      userEmail,
      username: usernameMap[userEmail] ?? "Anonymous",
      questionCount,
      requestedQuestionCount,
      requestedQuestionCountSource,
      questionCountMismatch,
      answerKeyFromPdfCount,
      answerKeyLabel: answerKey.label,
      answerKeyKind: answerKey.kind,
      answerKeyTitle: answerKey.title,
      isPublished: u.is_published === true,
      moderationStatus: u.moderation_status ?? "draft",
      publishRequestedAt: u.publish_requested_at,
      sourceType: u.source_type ?? null,
      sourceName: u.source_name ?? null,
      sourceUrl: u.source_url ?? null,
      hasSource: examHasSource({
        sourceType: u.source_type,
        sourceName: u.source_name,
      }),
      canEditSource: canAdminEditExamSource({
        isPublished: u.is_published === true,
        moderationStatus: u.moderation_status,
      }),
      createdAt: u.created_at,
      hasStoragePath: Boolean(storagePath && storagePath.endsWith(".pdf")),
    };
  });
}

/**
 * GET /api/admin/pdfs
 * List all PDF uploads with search/filter for admin panel.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const userFilter = searchParams.get("user")?.trim() ?? "";
    const subjectRaw = searchParams.get("subject")?.trim() ?? "";
    const programRaw = (searchParams.get("program") || "").toUpperCase();
    const program = programRaw === "SAT" ? "SAT" : programRaw === "AP" ? "AP" : null;
    const mismatchOnly =
      searchParams.get("mismatch") === "1" || searchParams.get("mismatch") === "true";

    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const supabase = createServerSupabaseAdmin();

    let userEmails: string[] | null = null;
    if (userFilter) {
      userEmails = await resolveUserEmails(supabase, userFilter);
      if (userEmails.length === 0) {
        return NextResponse.json({ pdfs: [], total: 0, limit, offset, mismatchOnly });
      }
    }

    let qMatchedEmails: string[] = [];
    if (q) {
      qMatchedEmails = await resolveUserEmails(supabase, q);
    }

    let query = supabase
      .from("pdf_uploads")
      .select(
        "id, filename, subject, user_email, created_at, exam_program, is_published, moderation_status, publish_requested_at, storage_path, requested_question_count, answer_key_from_pdf_count, source_type, source_name, source_url"
      )
      .order("created_at", { ascending: false });

    if (subjectRaw && SUBJECT_KEYS.includes(subjectRaw as SubjectKey)) {
      query = query.eq("subject", subjectRaw);
    }

    if (program === "SAT") {
      query = query.eq("exam_program", "SAT");
    } else if (program === "AP") {
      query = query.or("exam_program.eq.AP,exam_program.is.null");
    }

    if (userEmails) {
      query = query.in("user_email", userEmails);
    }

    if (q) {
      const escapedQ = escapeIlike(q);
      const orParts = [`filename.ilike.%${escapedQ}%`, `user_email.ilike.%${escapedQ}%`];
      for (const email of qMatchedEmails) {
        orParts.push(`user_email.eq.${email}`);
      }
      query = query.or(orParts.join(","));
    }

    if (mismatchOnly) {
      const { data: uploads, error: uploadsError } = await query;

      if (uploadsError) {
        console.error("admin/pdfs list:", uploadsError);
        return NextResponse.json({ error: "Could not load PDF list." }, { status: 500 });
      }

      const allRows = await mapUploadsToPdfRows(supabase, (uploads ?? []) as UploadRow[]);
      const filtered = allRows.filter((row) => row.questionCountMismatch);
      const pdfs = filtered.slice(offset, offset + limit);

      return NextResponse.json(
        { pdfs, total: filtered.length, limit, offset, mismatchOnly: true },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const { data: uploads, error: uploadsError, count } = await query.range(offset, offset + limit - 1);

    if (uploadsError) {
      console.error("admin/pdfs list:", uploadsError);
      return NextResponse.json({ error: "Could not load PDF list." }, { status: 500 });
    }

    const pdfs = await mapUploadsToPdfRows(supabase, (uploads ?? []) as UploadRow[]);

    return NextResponse.json(
      { pdfs, total: count ?? pdfs.length, limit, offset, mismatchOnly: false },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("admin/pdfs:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
