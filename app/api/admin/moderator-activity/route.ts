import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import {
  deriveExamModerationAction,
  frqExamActivityLabel,
  mcqExamActivityLabel,
  type ModeratorActivityAction,
  type ModeratorActivityItem,
} from "@/lib/moderator-activity";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const EXAM_ACTIONS = new Set<ModeratorActivityAction>(["approve", "reject", "unpublish"]);
const REPORT_ACTIONS = new Set<ModeratorActivityAction>(["dismiss", "delete", "notify"]);

function parseLimit(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseOffset(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeModeratorFilter(value: string | null): string | null {
  if (!value?.trim()) return null;
  return value.trim().toLowerCase();
}

async function attachFirstQuestionIds(
  supabase: SupabaseClient,
  items: ModeratorActivityItem[]
): Promise<ModeratorActivityItem[]> {
  const mcqUploadIds = [
    ...new Set(
      items
        .filter((item) => item.targetType === "exam_mcq" && item.uploadId)
        .map((item) => item.uploadId as string)
    ),
  ];
  const frqUploadIds = [
    ...new Set(
      items
        .filter((item) => item.targetType === "exam_frq" && item.uploadId)
        .map((item) => item.uploadId as string)
    ),
  ];

  if (mcqUploadIds.length === 0 && frqUploadIds.length === 0) {
    return items;
  }

  const mcqFirstQuestion = new Map<string, string>();
  const frqFirstQuestion = new Map<string, string>();

  const [mcqResult, frqResult] = await Promise.all([
    mcqUploadIds.length
      ? supabase
          .from("questions")
          .select("id, upload_id, question_number")
          .in("upload_id", mcqUploadIds)
          .order("question_number", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; upload_id: string; question_number: number }[] }),
    frqUploadIds.length
      ? supabase
          .from("frq_questions")
          .select("id, frq_upload_id, question_number")
          .in("frq_upload_id", frqUploadIds)
          .order("question_number", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; frq_upload_id: string; question_number: number }[] }),
  ]);

  for (const row of mcqResult.data ?? []) {
    const uploadId = String(row.upload_id);
    if (!mcqFirstQuestion.has(uploadId)) {
      mcqFirstQuestion.set(uploadId, String(row.id));
    }
  }

  for (const row of frqResult.data ?? []) {
    const uploadId = String(row.frq_upload_id);
    if (!frqFirstQuestion.has(uploadId)) {
      frqFirstQuestion.set(uploadId, String(row.id));
    }
  }

  return items.map((item) => {
    if (!item.uploadId || item.questionId) return item;
    if (item.targetType === "exam_mcq") {
      const questionId = mcqFirstQuestion.get(item.uploadId);
      return questionId ? { ...item, questionId } : item;
    }
    if (item.targetType === "exam_frq") {
      const questionId = frqFirstQuestion.get(item.uploadId);
      return questionId ? { ...item, questionId } : item;
    }
    return item;
  });
}

/**
 * GET /api/admin/moderator-activity?moderator=&action=&limit=&offset=
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const moderatorFilter = normalizeModeratorFilter(searchParams.get("moderator"));
    const actionFilter = searchParams.get("action")?.trim().toLowerCase() ?? "";
    const limit = parseLimit(searchParams.get("limit"));
    const offset = parseOffset(searchParams.get("offset"));

    const includeExamActions = !actionFilter || EXAM_ACTIONS.has(actionFilter as ModeratorActivityAction);
    const includeReportActions =
      !actionFilter || REPORT_ACTIONS.has(actionFilter as ModeratorActivityAction);

    const supabase = createServerSupabaseAdmin();
    const feed: ModeratorActivityItem[] = [];

    if (includeExamActions) {
      let mcqQuery = supabase
        .from("pdf_uploads")
        .select(
          "id, filename, display_title, moderation_status, is_published, moderated_at, moderated_by, storage_path"
        )
        .not("moderated_by", "is", null)
        .not("moderated_at", "is", null);

      if (moderatorFilter) {
        mcqQuery = mcqQuery.eq("moderated_by", moderatorFilter);
      }

      const { data: mcqRows, error: mcqError } = await mcqQuery;
      if (mcqError) {
        console.error("moderator-activity mcq:", mcqError);
        return NextResponse.json({ error: "Could not load activity." }, { status: 500 });
      }

      for (const row of mcqRows ?? []) {
        const action = deriveExamModerationAction({
          moderationStatus: row.moderation_status as string | null,
          isPublished: row.is_published as boolean | null,
        });
        if (!action) continue;
        if (actionFilter && action !== actionFilter) continue;

        feed.push({
          id: `mcq:${row.id}:${row.moderated_at}`,
          at: String(row.moderated_at),
          moderatorEmail: String(row.moderated_by ?? ""),
          action,
          targetType: "exam_mcq",
          targetLabel: mcqExamActivityLabel({
            displayTitle: row.display_title as string | null,
            filename: row.filename as string | null,
          }),
          note: null,
          uploadId: String(row.id),
          questionId: null,
          partLabel: null,
          hasStoragePath: Boolean((row.storage_path as string | null)?.trim()),
          examKind: "mcq",
        });
      }

      let frqQuery = supabase
        .from("frq_uploads")
        .select(
          "id, title, display_title, moderation_status, is_published, moderated_at, moderated_by, storage_path"
        )
        .not("moderated_by", "is", null)
        .not("moderated_at", "is", null);

      if (moderatorFilter) {
        frqQuery = frqQuery.eq("moderated_by", moderatorFilter);
      }

      const { data: frqRows, error: frqError } = await frqQuery;
      if (frqError) {
        console.error("moderator-activity frq:", frqError);
        return NextResponse.json({ error: "Could not load activity." }, { status: 500 });
      }

      for (const row of frqRows ?? []) {
        const action = deriveExamModerationAction({
          moderationStatus: row.moderation_status as string | null,
          isPublished: row.is_published as boolean | null,
        });
        if (!action) continue;
        if (actionFilter && action !== actionFilter) continue;

        feed.push({
          id: `frq:${row.id}:${row.moderated_at}`,
          at: String(row.moderated_at),
          moderatorEmail: String(row.moderated_by ?? ""),
          action,
          targetType: "exam_frq",
          targetLabel: frqExamActivityLabel({
            displayTitle: row.display_title as string | null,
            title: row.title as string | null,
          }),
          note: null,
          uploadId: String(row.id),
          questionId: null,
          partLabel: null,
          hasStoragePath: Boolean((row.storage_path as string | null)?.trim()),
          examKind: "frq",
        });
      }
    }

    if (includeReportActions) {
      let reportQuery = supabase
        .from("question_report_actions")
        .select("id, question_id, action, moderator_email, note, created_at")
        .order("created_at", { ascending: false });

      if (moderatorFilter) {
        reportQuery = reportQuery.eq("moderator_email", moderatorFilter);
      }
      if (actionFilter && REPORT_ACTIONS.has(actionFilter as ModeratorActivityAction)) {
        reportQuery = reportQuery.eq("action", actionFilter);
      }

      const { data: reportRows, error: reportError } = await reportQuery;
      if (reportError) {
        console.error("moderator-activity reports:", reportError);
        return NextResponse.json({ error: "Could not load activity." }, { status: 500 });
      }

      const questionIds = [...new Set((reportRows ?? []).map((r) => String(r.question_id)))];
      const mcqQuestionMap = new Map<
        string,
        { questionNumber: number; examName: string; uploadId: string }
      >();
      const frqQuestionMap = new Map<
        string,
        { questionNumber: number; partLabel: string | null; examName: string; uploadId: string }
      >();
      const mcqStoragePath = new Map<string, boolean>();
      const frqStoragePath = new Map<string, boolean>();

      if (questionIds.length > 0) {
        const [{ data: mcqQuestions }, { data: frqQuestions }] = await Promise.all([
          supabase
            .from("questions")
            .select("id, question_number, upload_id")
            .in("id", questionIds),
          supabase
            .from("frq_questions")
            .select("id, question_number, part_label, frq_upload_id")
            .in("id", questionIds),
        ]);

        const mcqUploadIds = [...new Set((mcqQuestions ?? []).map((q) => String(q.upload_id)))];
        const frqUploadIds = [...new Set((frqQuestions ?? []).map((q) => String(q.frq_upload_id)))];

        const [{ data: mcqUploads }, { data: frqUploads }] = await Promise.all([
          mcqUploadIds.length
            ? supabase
                .from("pdf_uploads")
                .select("id, filename, display_title, storage_path")
                .in("id", mcqUploadIds)
            : Promise.resolve({
                data: [] as { id: string; filename: string | null; display_title: string | null; storage_path: string | null }[],
              }),
          frqUploadIds.length
            ? supabase
                .from("frq_uploads")
                .select("id, title, display_title, storage_path")
                .in("id", frqUploadIds)
            : Promise.resolve({
                data: [] as { id: string; title: string | null; display_title: string | null; storage_path: string | null }[],
              }),
        ]);

        const mcqUploadName = new Map(
          (mcqUploads ?? []).map((u) => [
            String(u.id),
            mcqExamActivityLabel({
              displayTitle: u.display_title,
              filename: u.filename,
            }),
          ])
        );
        const frqUploadName = new Map(
          (frqUploads ?? []).map((u) => [
            String(u.id),
            frqExamActivityLabel({
              displayTitle: u.display_title,
              title: u.title,
            }),
          ])
        );
        for (const u of mcqUploads ?? []) {
          mcqStoragePath.set(String(u.id), Boolean((u.storage_path as string | null)?.trim()));
        }
        for (const u of frqUploads ?? []) {
          frqStoragePath.set(String(u.id), Boolean((u.storage_path as string | null)?.trim()));
        }

        for (const q of mcqQuestions ?? []) {
          const uploadId = String(q.upload_id);
          mcqQuestionMap.set(String(q.id), {
            questionNumber: Number(q.question_number) || 0,
            examName: mcqUploadName.get(uploadId) ?? "MCQ exam",
            uploadId,
          });
        }
        for (const q of frqQuestions ?? []) {
          const uploadId = String(q.frq_upload_id);
          frqQuestionMap.set(String(q.id), {
            questionNumber: Number(q.question_number) || 0,
            partLabel: (q.part_label as string | null) ?? null,
            examName: frqUploadName.get(uploadId) ?? "FRQ exam",
            uploadId,
          });
        }
      }

      for (const row of reportRows ?? []) {
        const action = row.action as ModeratorActivityAction;
        if (!REPORT_ACTIONS.has(action)) continue;
        if (actionFilter && action !== actionFilter) continue;

        const qid = String(row.question_id);
        const mcq = mcqQuestionMap.get(qid);
        const frq = frqQuestionMap.get(qid);
        let targetLabel = "Reported question";
        let uploadId: string | null = null;
        let hasStoragePath = false;
        let examKind: "mcq" | "frq" | null = null;
        let partLabel: string | null = null;

        if (mcq) {
          targetLabel = `Q#${mcq.questionNumber} · ${mcq.examName}`;
          uploadId = mcq.uploadId;
          hasStoragePath = mcqStoragePath.get(mcq.uploadId) ?? false;
          examKind = "mcq";
        } else if (frq) {
          const part = frq.partLabel ? ` (${frq.partLabel})` : "";
          targetLabel = `Q#${frq.questionNumber}${part} · ${frq.examName}`;
          uploadId = frq.uploadId;
          hasStoragePath = frqStoragePath.get(frq.uploadId) ?? false;
          examKind = "frq";
          partLabel = frq.partLabel;
        }

        feed.push({
          id: `report:${row.id}`,
          at: String(row.created_at),
          moderatorEmail: String(row.moderator_email ?? ""),
          action,
          targetType: "report",
          targetLabel,
          note: (row.note as string | null) ?? null,
          uploadId,
          questionId: qid,
          partLabel,
          hasStoragePath,
          examKind,
        });
      }
    }

    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const total = feed.length;
    const sliced = feed.slice(offset, offset + limit);
    const items = await attachFirstQuestionIds(supabase, sliced);

    const { data: moderatorRows } = await supabase
      .from("moderators")
      .select("email")
      .eq("active", true);

    const fromRegistry = (moderatorRows ?? [])
      .map((row) => String(row.email ?? "").trim().toLowerCase())
      .filter(Boolean);
    const fromFeed = feed.map((item) => item.moderatorEmail.trim().toLowerCase()).filter(Boolean);
    const moderatorEmails = [...new Set([...fromRegistry, ...fromFeed])].sort();

    return NextResponse.json({ items, total, moderatorEmails });
  } catch (err) {
    console.error("GET /api/admin/moderator-activity:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
