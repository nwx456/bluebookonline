import { NextRequest, NextResponse } from "next/server";
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
          "id, filename, display_title, moderation_status, is_published, moderated_at, moderated_by"
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
        });
      }

      let frqQuery = supabase
        .from("frq_uploads")
        .select(
          "id, title, display_title, moderation_status, is_published, moderated_at, moderated_by"
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
        { questionNumber: number; examName: string }
      >();
      const frqQuestionMap = new Map<
        string,
        { questionNumber: number; partLabel: string | null; examName: string }
      >();

      if (questionIds.length > 0) {
        const [{ data: mcqQuestions }, { data: frqQuestions }] = await Promise.all([
          supabase
            .from("questions")
            .select("id, question_number, upload_id")
            .in("id", questionIds),
          supabase
            .from("frq_questions")
            .select("id, question_number, part_label, upload_id")
            .in("id", questionIds),
        ]);

        const mcqUploadIds = [...new Set((mcqQuestions ?? []).map((q) => String(q.upload_id)))];
        const frqUploadIds = [...new Set((frqQuestions ?? []).map((q) => String(q.upload_id)))];

        const [{ data: mcqUploads }, { data: frqUploads }] = await Promise.all([
          mcqUploadIds.length
            ? supabase
                .from("pdf_uploads")
                .select("id, filename, display_title")
                .in("id", mcqUploadIds)
            : Promise.resolve({ data: [] as { id: string; filename: string | null; display_title: string | null }[] }),
          frqUploadIds.length
            ? supabase
                .from("frq_uploads")
                .select("id, title, display_title")
                .in("id", frqUploadIds)
            : Promise.resolve({ data: [] as { id: string; title: string | null; display_title: string | null }[] }),
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

        for (const q of mcqQuestions ?? []) {
          mcqQuestionMap.set(String(q.id), {
            questionNumber: Number(q.question_number) || 0,
            examName: mcqUploadName.get(String(q.upload_id)) ?? "MCQ exam",
          });
        }
        for (const q of frqQuestions ?? []) {
          frqQuestionMap.set(String(q.id), {
            questionNumber: Number(q.question_number) || 0,
            partLabel: (q.part_label as string | null) ?? null,
            examName: frqUploadName.get(String(q.upload_id)) ?? "FRQ exam",
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
        if (mcq) {
          targetLabel = `Q#${mcq.questionNumber} · ${mcq.examName}`;
        } else if (frq) {
          const part = frq.partLabel ? ` (${frq.partLabel})` : "";
          targetLabel = `Q#${frq.questionNumber}${part} · ${frq.examName}`;
        }

        feed.push({
          id: `report:${row.id}`,
          at: String(row.created_at),
          moderatorEmail: String(row.moderator_email ?? ""),
          action,
          targetType: "report",
          targetLabel,
          note: (row.note as string | null) ?? null,
        });
      }
    }

    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const total = feed.length;
    const items = feed.slice(offset, offset + limit);

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
