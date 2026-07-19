import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  QUESTION_REPORT_REASON_LABELS,
  type QuestionReportReasonCode,
} from "@/lib/question-report-reasons";
import { formatSourceAttribution } from "@/lib/exam-source";
import { getMcqExamDisplayName, getFrqExamDisplayName } from "@/lib/exam-display-name";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { getFrqCourseLabel } from "@/lib/frq-courses";

export type ReportStatusFilter = "open" | "dismissed" | "all";
export type ExamKind = "mcq" | "frq";

export type QuestionReportInboxItem = {
  questionId: string;
  uploadId: string;
  examKind: ExamKind;
  partLabel: string | null;
  questionNumber: number;
  questionText: string;
  questionType: string | null;
  correctAnswer: string | null;
  options: Record<string, string | null>;
  reportCount: number;
  reporterCount: number;
  reasonCounts: { code: string; label: string; count: number }[];
  customNotes: { emailMasked: string; note: string; createdAt: string }[];
  lastReportedAt: string;
  status: "open" | "dismissed" | "mixed";
  exam: {
    filename: string;
    subject: string;
    subjectLabel: string;
    examProgram: string | null;
    userEmail: string;
    sourceAttribution: string | null;
  };
};

type ReportRow = {
  id: string;
  exam_kind: string;
  question_id: string | null;
  upload_id: string | null;
  frq_question_id: string | null;
  frq_upload_id: string | null;
  part_label: string | null;
  user_email: string;
  reason_codes: string[] | null;
  custom_note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ReportGroup = {
  examKind: ExamKind;
  questionId: string;
  uploadId: string;
  partLabel: string | null;
  rows: ReportRow[];
};

type FrqPart = { label?: string; prompt?: string; max_points?: number };

function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function subjectLabel(subject: string | null): string {
  if (!subject) return "Unknown";
  return SUBJECT_LABELS[subject as SubjectKey] ?? subject;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reportGroupKey(row: ReportRow): string | null {
  const examKind = (row.exam_kind ?? "mcq") as ExamKind;
  if (examKind === "frq") {
    if (!row.frq_question_id) return null;
    return `frq:${row.frq_question_id}:${row.part_label ?? ""}`;
  }
  if (!row.question_id) return null;
  return `mcq:${row.question_id}`;
}

function buildGroupFromRow(row: ReportRow): Omit<ReportGroup, "rows"> | null {
  const examKind = (row.exam_kind ?? "mcq") as ExamKind;
  if (examKind === "frq") {
    if (!row.frq_question_id || !row.frq_upload_id) return null;
    return {
      examKind: "frq",
      questionId: row.frq_question_id,
      uploadId: row.frq_upload_id,
      partLabel: row.part_label ?? null,
    };
  }
  if (!row.question_id || !row.upload_id) return null;
  return {
    examKind: "mcq",
    questionId: row.question_id,
    uploadId: row.upload_id,
    partLabel: null,
  };
}

function frqPartPrompt(parts: unknown, partLabel: string | null): string | null {
  if (!partLabel || !Array.isArray(parts)) return null;
  const match = (parts as FrqPart[]).find(
    (part) => (part.label ?? "").trim().toUpperCase() === partLabel.trim().toUpperCase()
  );
  return match?.prompt ? stripHtmlToText(match.prompt) : null;
}

function aggregateReportRows(rows: ReportRow[]) {
  const reasonCountMap = new Map<string, number>();
  const reporters = new Set<string>();
  const customNotes: QuestionReportInboxItem["customNotes"] = [];
  let lastReportedAt = rows[0]?.updated_at ?? new Date(0).toISOString();

  for (const row of rows) {
    reporters.add(row.user_email);
    for (const code of row.reason_codes ?? []) {
      reasonCountMap.set(code, (reasonCountMap.get(code) ?? 0) + 1);
    }
    const note = row.custom_note?.trim();
    if (note) {
      customNotes.push({
        emailMasked: maskEmail(row.user_email),
        note,
        createdAt: row.created_at,
      });
    }
    if (row.updated_at > lastReportedAt) lastReportedAt = row.updated_at;
  }

  const statuses = new Set(rows.map((row) => row.status));
  let status: QuestionReportInboxItem["status"] = "open";
  if (statuses.has("open") && statuses.size > 1) status = "mixed";
  else if (statuses.has("dismissed") && !statuses.has("open")) status = "dismissed";

  const reasonCounts = [...reasonCountMap.entries()]
    .map(([code, count]) => ({
      code,
      label: QUESTION_REPORT_REASON_LABELS[code as QuestionReportReasonCode] ?? code,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    reportCount: rows.length,
    reporterCount: reporters.size,
    reasonCounts,
    customNotes,
    lastReportedAt,
    status,
  };
}

const REPORTS_PAGE_SIZE = 1000;

async function fetchAllReportRows(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  status: ReportStatusFilter
): Promise<ReportRow[]> {
  const all: ReportRow[] = [];
  let from = 0;

  for (;;) {
    let reportQuery = supabase
      .from("question_reports")
      .select(
        "id, exam_kind, question_id, upload_id, frq_question_id, frq_upload_id, part_label, user_email, reason_codes, custom_note, status, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .range(from, from + REPORTS_PAGE_SIZE - 1);

    if (status === "open") {
      reportQuery = reportQuery.eq("status", "open");
    } else if (status === "dismissed") {
      reportQuery = reportQuery.eq("status", "dismissed");
    }

    const { data: page, error } = await reportQuery;
    if (error) {
      console.error("fetchAllReportRows error:", error);
      throw new Error("Failed to load reports.");
    }
    if (!page?.length) break;

    all.push(...(page as ReportRow[]));
    if (page.length < REPORTS_PAGE_SIZE) break;
    from += REPORTS_PAGE_SIZE;
  }

  return all;
}

function groupLastUpdatedAt(group: ReportGroup): number {
  return Math.max(...group.rows.map((row) => new Date(row.updated_at).getTime()));
}

export async function fetchQuestionReportInbox(params: {
  status: ReportStatusFilter;
  limit?: number;
  offset?: number;
}): Promise<{ items: QuestionReportInboxItem[]; total: number }> {
  const supabase = createServerSupabaseAdmin();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const reports = await fetchAllReportRows(supabase, params.status);

  const grouped = new Map<string, ReportGroup>();
  for (const row of reports) {
    const key = reportGroupKey(row);
    const meta = buildGroupFromRow(row);
    if (!key || !meta) continue;

    const existing = grouped.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      grouped.set(key, { ...meta, rows: [row] });
    }
  }

  const sortedGroupKeys = [...grouped.entries()]
    .sort((a, b) => groupLastUpdatedAt(b[1]) - groupLastUpdatedAt(a[1]))
    .map(([key]) => key);
  const total = sortedGroupKeys.length;
  const pageKeys = sortedGroupKeys.slice(offset, offset + limit);

  if (pageKeys.length === 0) {
    return { items: [], total };
  }

  const pageGroups = pageKeys.map((key) => grouped.get(key)!);
  const mcqQuestionIds = [
    ...new Set(pageGroups.filter((g) => g.examKind === "mcq").map((g) => g.questionId)),
  ];
  const frqQuestionIds = [
    ...new Set(pageGroups.filter((g) => g.examKind === "frq").map((g) => g.questionId)),
  ];
  const mcqUploadIds = [
    ...new Set(pageGroups.filter((g) => g.examKind === "mcq").map((g) => g.uploadId)),
  ];
  const frqUploadIds = [
    ...new Set(pageGroups.filter((g) => g.examKind === "frq").map((g) => g.uploadId)),
  ];

  const [
    { data: mcqQuestions, error: mcqQuestionsError },
    { data: frqQuestions, error: frqQuestionsError },
    { data: mcqUploads, error: mcqUploadsError },
    { data: frqUploads, error: frqUploadsError },
  ] = await Promise.all([
    mcqQuestionIds.length
      ? supabase.from("questions").select("*").in("id", mcqQuestionIds)
      : Promise.resolve({ data: [], error: null }),
    frqQuestionIds.length
      ? supabase.from("frq_questions").select("*").in("id", frqQuestionIds)
      : Promise.resolve({ data: [], error: null }),
    mcqUploadIds.length
      ? supabase
          .from("pdf_uploads")
          .select(
            "id, filename, display_title, subject, exam_program, user_email, source_type, source_name, source_url"
          )
          .in("id", mcqUploadIds)
      : Promise.resolve({ data: [], error: null }),
    frqUploadIds.length
      ? supabase
          .from("frq_uploads")
          .select(
            "id, title, display_title, course_id, user_email, source_type, source_name, source_url"
          )
          .in("id", frqUploadIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mcqQuestionsError || frqQuestionsError || mcqUploadsError || frqUploadsError) {
    console.error("fetchQuestionReportInbox lookup error:", {
      mcqQuestionsError,
      frqQuestionsError,
      mcqUploadsError,
      frqUploadsError,
    });
    throw new Error("Failed to load report context.");
  }

  const mcqQuestionMap = new Map((mcqQuestions ?? []).map((q) => [q.id as string, q]));
  const frqQuestionMap = new Map((frqQuestions ?? []).map((q) => [q.id as string, q]));
  const mcqUploadMap = new Map((mcqUploads ?? []).map((u) => [u.id as string, u]));
  const frqUploadMap = new Map((frqUploads ?? []).map((u) => [u.id as string, u]));

  const items: QuestionReportInboxItem[] = [];

  for (const group of pageGroups) {
    const aggregate = aggregateReportRows(group.rows);

    if (group.examKind === "mcq") {
      const question = mcqQuestionMap.get(group.questionId);
      const upload = mcqUploadMap.get(group.uploadId);
      const source = upload
        ? formatSourceAttribution({
            source_type: upload.source_type as string | null,
            source_name: upload.source_name as string | null,
            source_url: upload.source_url as string | null,
          })
        : null;

      items.push({
        questionId: group.questionId,
        uploadId: group.uploadId,
        examKind: "mcq",
        partLabel: null,
        questionNumber: (question?.question_number as number | undefined) ?? 0,
        questionText:
          (question?.question_text as string | undefined) ??
          "[Question removed from exam]",
        questionType: (question?.question_type as string | null | undefined) ?? "mcq",
        correctAnswer: (question?.correct_answer as string | null | undefined) ?? null,
        options: {
          A: (question?.option_a as string | null | undefined) ?? null,
          B: (question?.option_b as string | null | undefined) ?? null,
          C: (question?.option_c as string | null | undefined) ?? null,
          D: (question?.option_d as string | null | undefined) ?? null,
          E: (question?.option_e as string | null | undefined) ?? null,
        },
        ...aggregate,
        exam: {
          filename: getMcqExamDisplayName({
            displayTitle: upload?.display_title as string | null | undefined,
            filename: upload?.filename as string | null | undefined,
            fallback: "Unknown exam",
          }),
          subject: (upload?.subject as string | undefined) ?? "",
          subjectLabel: subjectLabel((upload?.subject as string | undefined) ?? null),
          examProgram: (upload?.exam_program as string | null | undefined) ?? null,
          userEmail: (upload?.user_email as string | undefined) ?? "",
          sourceAttribution: source?.text ?? null,
        },
      });
      continue;
    }

    const question = frqQuestionMap.get(group.questionId);
    const upload = frqUploadMap.get(group.uploadId);
    const partPrompt = frqPartPrompt(question?.parts, group.partLabel);
    const promptText = stripHtmlToText((question?.prompt_html as string | undefined) ?? "");
    const questionText = partPrompt
      ? partPrompt
      : promptText || "[FRQ question unavailable]";
    const source = upload
      ? formatSourceAttribution({
          source_type: upload.source_type as string | null,
          source_name: upload.source_name as string | null,
          source_url: upload.source_url as string | null,
        })
      : null;
    const courseId = (upload?.course_id as string | undefined) ?? "";

    items.push({
      questionId: group.questionId,
      uploadId: group.uploadId,
      examKind: "frq",
      partLabel: group.partLabel,
      questionNumber: (question?.question_number as number | undefined) ?? 0,
      questionText,
      questionType: (question?.question_type as string | null | undefined) ?? "generic",
      correctAnswer: null,
      options: {},
      ...aggregate,
      exam: {
        filename: getFrqExamDisplayName({
          displayTitle: upload?.display_title as string | null | undefined,
          title: upload?.title as string | null | undefined,
          fallback: "Unknown FRQ exam",
        }),
        subject: courseId,
        subjectLabel: getFrqCourseLabel(courseId),
        examProgram: "FRQ",
        userEmail: (upload?.user_email as string | undefined) ?? "",
        sourceAttribution: source?.text ?? null,
      },
    });
  }

  items.sort(
    (a, b) => new Date(b.lastReportedAt).getTime() - new Date(a.lastReportedAt).getTime()
  );

  return { items, total };
}

export type QuestionReportActionContext = {
  examKind?: ExamKind;
  partLabel?: string | null;
};

function reportFilterForQuestion(
  questionId: string,
  context?: QuestionReportActionContext
) {
  const supabase = createServerSupabaseAdmin();
  const examKind = context?.examKind;

  if (examKind === "frq") {
    let query = supabase.from("question_reports").select("*").eq("frq_question_id", questionId);
    if (context && "partLabel" in context) {
      const partLabel = context.partLabel ?? null;
      if (partLabel) {
        query = query.eq("part_label", partLabel);
      } else {
        query = query.is("part_label", null);
      }
    }
    return query;
  }

  if (examKind === "mcq") {
    return supabase.from("question_reports").select("*").eq("question_id", questionId);
  }

  return supabase
    .from("question_reports")
    .select("*")
    .or(`question_id.eq.${questionId},frq_question_id.eq.${questionId}`);
}

export async function fetchQuestionReportDetail(
  questionId: string,
  context?: QuestionReportActionContext
) {
  const supabase = createServerSupabaseAdmin();
  const { data: reports, error: reportsError } = await reportFilterForQuestion(
    questionId,
    context
  ).order("created_at", { ascending: false });

  if (reportsError) {
    throw new Error("Failed to load report detail.");
  }

  if (!reports?.length) {
    return null;
  }

  const examKind = ((reports[0].exam_kind as string | undefined) ?? "mcq") as ExamKind;

  if (examKind === "frq") {
    const uploadId = reports[0].frq_upload_id as string;
    const [{ data: question }, { data: upload }] = await Promise.all([
      supabase.from("frq_questions").select("*").eq("id", questionId).maybeSingle(),
      supabase
        .from("frq_uploads")
        .select(
          "id, title, display_title, course_id, user_email, source_type, source_name, source_url, moderation_status, is_published"
        )
        .eq("id", uploadId)
        .maybeSingle(),
    ]);

    const reporters = reports.map((r) => ({
      id: r.id as string,
      emailMasked: maskEmail(r.user_email as string),
      userEmail: r.user_email as string,
      reasonCodes: (r.reason_codes as string[]) ?? [],
      customNote: (r.custom_note as string | null) ?? null,
      status: r.status as string,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    const { items } = await fetchQuestionReportInbox({ status: "all", limit: 1000, offset: 0 });
    const partLabel = (reports[0].part_label as string | null) ?? null;
    const summary =
      items.find(
        (item) =>
          item.examKind === "frq" &&
          item.questionId === questionId &&
          (item.partLabel ?? null) === partLabel
      ) ?? null;

    return {
      question,
      upload,
      reporters,
      summary,
      examKind: "frq" as const,
    };
  }

  const uploadId = reports[0].upload_id as string;
  const [{ data: question }, { data: upload }] = await Promise.all([
    supabase.from("questions").select("*").eq("id", questionId).maybeSingle(),
    supabase
      .from("pdf_uploads")
      .select(
        "id, filename, subject, exam_program, user_email, source_type, source_name, source_url, moderation_status, is_published"
      )
      .eq("id", uploadId)
      .maybeSingle(),
  ]);

  const reporters = reports.map((r) => ({
    id: r.id as string,
    emailMasked: maskEmail(r.user_email as string),
    userEmail: r.user_email as string,
    reasonCodes: (r.reason_codes as string[]) ?? [],
    customNote: (r.custom_note as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  const { items } = await fetchQuestionReportInbox({ status: "all", limit: 1000, offset: 0 });
  const summary = items.find((item) => item.examKind === "mcq" && item.questionId === questionId) ?? null;

  return {
    question,
    upload,
    reporters,
    summary,
    examKind: "mcq" as const,
  };
}

export async function hardDeleteReportedQuestion(params: {
  questionId: string;
  moderatorEmail: string;
  note?: string;
  examKind?: ExamKind;
  partLabel?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerSupabaseAdmin();
  const { questionId, moderatorEmail, note, examKind = "mcq", partLabel = null } = params;

  if (examKind === "frq") {
    const { data: question, error: questionError } = await supabase
      .from("frq_questions")
      .select("*")
      .eq("id", questionId)
      .maybeSingle();

    if (questionError || !question) {
      return { ok: false, error: "Question not found." };
    }

    const uploadId = question.frq_upload_id as string;
    const { data: upload } = await supabase
      .from("frq_uploads")
      .select(
        "id, title, display_title, course_id, user_email, source_type, source_name, source_url"
      )
      .eq("id", uploadId)
      .maybeSingle();

    let reportCountQuery = supabase
      .from("question_reports")
      .select("*", { count: "exact", head: true })
      .eq("frq_question_id", questionId);
    const { count: reportCount } = await reportCountQuery;

    const snapshot = {
      examKind: "frq",
      question,
      exam: upload ?? null,
      partLabel,
      deletedAt: new Date().toISOString(),
    };

    const { error: snapshotError } = await supabase.from("question_report_snapshots").insert({
      question_id: questionId,
      upload_id: uploadId,
      snapshot,
      deleted_by: moderatorEmail,
      report_count_at_delete: reportCount ?? 0,
    });

    if (snapshotError) {
      console.error("frq snapshot insert error:", snapshotError);
      return { ok: false, error: "Failed to create audit snapshot." };
    }

    const { error: responsesError } = await supabase
      .from("frq_responses")
      .delete()
      .eq("question_id", questionId);

    if (responsesError) {
      console.error("frq_responses delete error:", responsesError);
      return { ok: false, error: "Failed to remove FRQ responses." };
    }

    const { error: resolveError } = await supabase
      .from("question_reports")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("frq_question_id", questionId);
    if (resolveError) {
      console.error("frq question_reports resolve error:", resolveError);
      return { ok: false, error: "Failed to resolve reports." };
    }

    const { error: deleteError } = await supabase
      .from("frq_questions")
      .delete()
      .eq("id", questionId);

    if (deleteError) {
      console.error("frq_questions delete error:", deleteError);
      return { ok: false, error: "Failed to delete question." };
    }

    const { error: actionError } = await supabase.from("question_report_actions").insert({
      question_id: questionId,
      action: "delete",
      moderator_email: moderatorEmail,
      note: note?.trim() || null,
    });

    if (actionError) {
      console.error("question_report_actions insert error:", actionError);
    }

    return { ok: true };
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError || !question) {
    return { ok: false, error: "Question not found." };
  }

  const uploadId = question.upload_id as string;

  const { data: upload } = await supabase
    .from("pdf_uploads")
    .select(
      "id, filename, subject, exam_program, user_email, source_type, source_name, source_url"
    )
    .eq("id", uploadId)
    .maybeSingle();

  const { count: reportCount } = await supabase
    .from("question_reports")
    .select("*", { count: "exact", head: true })
    .eq("question_id", questionId);

  const snapshot = {
    examKind: "mcq",
    question,
    exam: upload ?? null,
    deletedAt: new Date().toISOString(),
  };

  const { error: snapshotError } = await supabase.from("question_report_snapshots").insert({
    question_id: questionId,
    upload_id: uploadId,
    snapshot,
    deleted_by: moderatorEmail,
    report_count_at_delete: reportCount ?? 0,
  });

  if (snapshotError) {
    console.error("snapshot insert error:", snapshotError);
    return { ok: false, error: "Failed to create audit snapshot." };
  }

  const { error: answersError } = await supabase
    .from("attempt_answers")
    .delete()
    .eq("question_id", questionId);

  if (answersError) {
    console.error("attempt_answers delete error:", answersError);
    return { ok: false, error: "Failed to remove attempt answers." };
  }

  const { error: resolveError } = await supabase
    .from("question_reports")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("question_id", questionId);

  if (resolveError) {
    console.error("question_reports resolve error:", resolveError);
    return { ok: false, error: "Failed to resolve reports." };
  }

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (deleteError) {
    console.error("questions delete error:", deleteError);
    return { ok: false, error: "Failed to delete question." };
  }

  const { error: actionError } = await supabase.from("question_report_actions").insert({
    question_id: questionId,
    action: "delete",
    moderator_email: moderatorEmail,
    note: note?.trim() || null,
  });

  if (actionError) {
    console.error("question_report_actions insert error:", actionError);
  }

  return { ok: true };
}

export async function dismissQuestionReports(params: {
  questionId: string;
  examKind?: ExamKind;
  partLabel?: string | null;
}): Promise<{ dismissed: number } | { error: string }> {
  const supabase = createServerSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: openReports, error: fetchError } = await reportFilterForQuestion(
    params.questionId,
    params
  )
    .eq("status", "open")
    .select("id");

  if (fetchError) {
    return { error: "Failed to load reports." };
  }

  if (!openReports?.length) {
    return { error: "No open reports to dismiss." };
  }

  let updateQuery = supabase
    .from("question_reports")
    .update({ status: "dismissed", updated_at: now })
    .eq("status", "open");

  if (params.examKind === "frq") {
    updateQuery = updateQuery.eq("frq_question_id", params.questionId);
    if ("partLabel" in params) {
      if (params.partLabel) {
        updateQuery = updateQuery.eq("part_label", params.partLabel);
      } else {
        updateQuery = updateQuery.is("part_label", null);
      }
    }
  } else if (params.examKind === "mcq") {
    updateQuery = updateQuery.eq("question_id", params.questionId);
  } else {
    updateQuery = updateQuery.or(
      `question_id.eq.${params.questionId},frq_question_id.eq.${params.questionId}`
    );
  }

  const { error: updateError } = await updateQuery;
  if (updateError) {
    return { error: "Failed to dismiss reports." };
  }

  return { dismissed: openReports.length };
}
