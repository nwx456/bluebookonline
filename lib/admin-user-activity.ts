import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDisplayTitle } from "@/lib/library-server";
import { buildLibraryInsights } from "@/lib/library-server";
import type { LibraryExamKind, LibraryInsightsPayload } from "@/lib/library-types";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { normalizeEmail } from "@/lib/moderator-auth";

export type AdminUserAttemptStatus = "completed" | "in_progress" | "abandoned";

export interface AdminUserProfile {
  email: string;
  username: string;
  role: string;
  countryCode: string | null;
  legalRegion: string | null;
  marketingOptIn: boolean;
  createdAt: string;
}

export interface AdminUserActivitySummary {
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  mcqAttempts: number;
  frqAttempts: number;
  averageApPercentage: number | null;
  averageSatTotal: number | null;
  lastActivityAt: string | null;
  questionReportCount: number;
  classCount: number;
}

export interface AdminUserAttemptItem {
  id: string;
  examKind: LibraryExamKind;
  uploadId: string;
  title: string;
  subject: string;
  subjectLabel: string;
  examProgram: "AP" | "SAT";
  status: AdminUserAttemptStatus;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  percentage: number | null;
  totalScaledScore: number | null;
  rwScaledScore: number | null;
  mathScaledScore: number | null;
  totalScore: number | null;
  maxScore: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  attemptNumberOnExam: number;
  isLate: boolean;
  assignmentId: string | null;
}

export interface AdminUserReportItem {
  id: string;
  examKind: "mcq" | "frq";
  uploadId: string | null;
  attemptId: string | null;
  examTitle: string;
  reasonCodes: string[];
  customNote: string | null;
  status: string;
  createdAt: string;
}

export interface AdminUserClassItem {
  id: string;
  name: string;
  classCode: string;
  role: "student" | "teacher";
  teacherEmail: string | null;
  teacherName: string | null;
  joinedAt: string | null;
  memberCount: number | null;
  assignmentCount: number | null;
  archived: boolean;
}

export interface AdminUserErrorItem {
  id: string;
  source: "client" | "server";
  errorName: string;
  message: string;
  pageUrl: string | null;
  endpoint: string | null;
  status: string;
  occurrenceCount: number;
  lastSeenAt: string;
}

export interface AdminUserActivityPayload {
  profile: AdminUserProfile;
  summary: AdminUserActivitySummary;
  insights: LibraryInsightsPayload;
  attempts: AdminUserAttemptItem[];
  attemptsTotal: number;
  reports: AdminUserReportItem[];
  classes: AdminUserClassItem[];
  errors: AdminUserErrorItem[];
}

export interface BuildAdminUserActivityOptions {
  attemptsLimit?: number;
  attemptsOffset?: number;
}

const ABANDONED_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveMcqStatus(completedAt: string | null, startedAt: string): AdminUserAttemptStatus {
  if (completedAt) return "completed";
  const startedMs = new Date(startedAt).getTime();
  if (Number.isFinite(startedMs) && Date.now() - startedMs > ABANDONED_AFTER_MS) {
    return "abandoned";
  }
  return "in_progress";
}

function resolveFrqStatus(
  status: string,
  completedAt: string | null,
  startedAt: string
): AdminUserAttemptStatus {
  if (status === "graded" && completedAt) return "completed";
  if (status === "in_progress") {
    const startedMs = new Date(startedAt).getTime();
    if (Number.isFinite(startedMs) && Date.now() - startedMs > ABANDONED_AFTER_MS) {
      return "abandoned";
    }
    return "in_progress";
  }
  if (completedAt) return "completed";
  return "in_progress";
}

function assignAttemptNumbers(attempts: AdminUserAttemptItem[]): AdminUserAttemptItem[] {
  const counters = new Map<string, number>();
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  for (const attempt of sorted) {
    const key = `${attempt.examKind}:${attempt.uploadId}`;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    attempt.attemptNumberOnExam = next;
  }

  return attempts.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

function computeSummary(attempts: AdminUserAttemptItem[], reportCount: number, classCount: number): AdminUserActivitySummary {
  const completed = attempts.filter((a) => a.status === "completed");
  const inProgress = attempts.filter((a) => a.status === "in_progress" || a.status === "abandoned");

  const apPercentages = completed
    .filter((a) => a.examProgram === "AP" && a.examKind === "mcq" && a.percentage != null)
    .map((a) => a.percentage as number);
  const apFrqPercentages = completed
    .filter((a) => a.examProgram === "AP" && a.examKind === "frq" && a.percentage != null)
    .map((a) => a.percentage as number);
  const allAp = [...apPercentages, ...apFrqPercentages];

  const satTotals = completed
    .filter((a) => a.examProgram === "SAT" && a.totalScaledScore != null)
    .map((a) => a.totalScaledScore as number);

  const activityDates = attempts
    .map((a) => a.completedAt ?? a.startedAt)
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter(Number.isFinite);

  return {
    totalAttempts: attempts.length,
    completedAttempts: completed.length,
    inProgressAttempts: inProgress.length,
    mcqAttempts: attempts.filter((a) => a.examKind === "mcq").length,
    frqAttempts: attempts.filter((a) => a.examKind === "frq").length,
    averageApPercentage:
      allAp.length > 0 ? Math.round(allAp.reduce((s, v) => s + v, 0) / allAp.length) : null,
    averageSatTotal:
      satTotals.length > 0
        ? Math.round(satTotals.reduce((s, v) => s + v, 0) / satTotals.length)
        : null,
    lastActivityAt:
      activityDates.length > 0
        ? new Date(Math.max(...activityDates)).toISOString()
        : null,
    questionReportCount: reportCount,
    classCount,
  };
}

async function fetchProfile(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserProfile | null> {
  const { data, error } = await supabase
    .from("usertable")
    .select("email, username, role, country_code, legal_region, marketing_opt_in, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    email: String(data.email ?? email),
    username: (data.username as string | null) ?? "",
    role: (data.role as string | null) ?? "STUDENT",
    countryCode: (data.country_code as string | null) ?? null,
    legalRegion: (data.legal_region as string | null) ?? null,
    marketingOptIn: data.marketing_opt_in === true,
    createdAt: String(data.created_at ?? ""),
  };
}

async function fetchMcqAttempts(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserAttemptItem[]> {
  const { data: rows, error } = await supabase
    .from("attempts")
    .select(
      "id, upload_id, display_title, started_at, completed_at, time_spent_seconds, correct_count, incorrect_count, unanswered_count, total_questions, skip_ai_grading, rw_scaled_score, math_scaled_score, total_scaled_score, assignment_id, is_late"
    )
    .eq("user_email", email)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);

  const attemptList = rows ?? [];
  const uploadIds = [...new Set(attemptList.map((a) => a.upload_id as string))];

  const { data: uploads } = uploadIds.length
    ? await supabase
        .from("pdf_uploads")
        .select("id, filename, subject, exam_program")
        .in("id", uploadIds)
    : { data: [] };

  const uploadMap = new Map<
    string,
    { filename: string; subject: string; examProgram: "AP" | "SAT" }
  >(
    (uploads ?? []).map((u) => [
      u.id as string,
      {
        filename: (u.filename as string | null) ?? "PDF",
        subject: (u.subject as string) ?? "AP_CSA",
        examProgram:
          (u as { exam_program?: string | null }).exam_program === "SAT" ? ("SAT" as const) : ("AP" as const),
      },
    ])
  );

  return attemptList.map((a) => {
    const upload = uploadMap.get(a.upload_id as string);
    const filename = upload?.filename ?? "PDF";
    const displayTitle = (a.display_title as string | null) ?? null;
    const title = resolveDisplayTitle(displayTitle, filename);
    const subject = upload?.subject ?? "AP_CSA";
    const examProgram: "AP" | "SAT" = upload?.examProgram ?? "AP";
    const startedAt = (a.started_at as string) ?? new Date().toISOString();
    const completedAt = (a.completed_at as string | null) ?? null;
    const total = (a.total_questions as number | null) ?? 0;
    const correct = (a.correct_count as number | null) ?? 0;
    const incorrect = (a.incorrect_count as number | null) ?? 0;
    const unanswered = (a.unanswered_count as number | null) ?? 0;
    const notGradedCount = Math.max(0, total - correct - incorrect - unanswered);
    const skipAiGrading = (a.skip_ai_grading as boolean | null) === true || notGradedCount > 0;
    const gradedAnswered = correct + incorrect;
    const percentage =
      completedAt && examProgram === "AP"
        ? skipAiGrading
          ? gradedAnswered > 0
            ? Math.round((correct / gradedAnswered) * 100)
            : null
          : total > 0
            ? Math.round((correct / total) * 100)
            : 0
        : null;

    return {
      id: a.id as string,
      examKind: "mcq" as const,
      uploadId: a.upload_id as string,
      title,
      subject,
      subjectLabel: subject,
      examProgram,
      status: resolveMcqStatus(completedAt, startedAt),
      startedAt,
      completedAt,
      timeSpentSeconds:
        typeof a.time_spent_seconds === "number" ? a.time_spent_seconds : null,
      percentage,
      totalScaledScore:
        typeof a.total_scaled_score === "number" ? a.total_scaled_score : null,
      rwScaledScore: typeof a.rw_scaled_score === "number" ? a.rw_scaled_score : null,
      mathScaledScore: typeof a.math_scaled_score === "number" ? a.math_scaled_score : null,
      totalScore: null,
      maxScore: null,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      attemptNumberOnExam: 0,
      isLate: a.is_late === true,
      assignmentId: (a.assignment_id as string | null) ?? null,
    };
  });
}

async function fetchFrqAttempts(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserAttemptItem[]> {
  const { data: rows, error } = await supabase
    .from("frq_attempts")
    .select(
      "id, frq_upload_id, display_title, status, started_at, completed_at, total_score, max_score, assignment_id, is_late"
    )
    .eq("user_email", email)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);

  const attemptList = rows ?? [];
  const uploadIds = [...new Set(attemptList.map((a) => a.frq_upload_id as string))];

  const { data: uploads } = uploadIds.length
    ? await supabase
        .from("frq_uploads")
        .select("id, title, display_title, course_id")
        .in("id", uploadIds)
    : { data: [] };

  const uploadMap = new Map(
    (uploads ?? []).map((u) => {
      const courseId = (u.course_id as string) ?? "AP_US_HISTORY";
      const titleRaw = (u.title as string) ?? "FRQ Exam";
      return [
        u.id as string,
        {
          filename: titleRaw,
          displayTitle: (u.display_title as string | null) ?? null,
          subject: courseId,
          courseLabel: getFrqCourseLabel(courseId),
        },
      ];
    })
  );

  return attemptList.map((a) => {
    const upload = uploadMap.get(a.frq_upload_id as string);
    const filename = upload?.filename ?? "FRQ Exam";
    const displayTitle = (a.display_title as string | null) ?? null;
    const title = resolveDisplayTitle(displayTitle, upload?.displayTitle ?? filename);
    const subject = upload?.subject ?? "AP_US_HISTORY";
    const startedAt = (a.started_at as string) ?? new Date().toISOString();
    const completedAt = (a.completed_at as string | null) ?? null;
    const statusRaw = String(a.status ?? "in_progress");
    const totalScore = a.total_score != null ? Number(a.total_score) : null;
    const maxScore = a.max_score != null ? Number(a.max_score) : null;
    const percentage =
      totalScore != null && maxScore != null && maxScore > 0
        ? Math.round((totalScore / maxScore) * 100)
        : null;

    return {
      id: a.id as string,
      examKind: "frq" as const,
      uploadId: a.frq_upload_id as string,
      title,
      subject,
      subjectLabel: upload?.courseLabel ?? getFrqCourseLabel(subject),
      examProgram: "AP" as const,
      status: resolveFrqStatus(statusRaw, completedAt, startedAt),
      startedAt,
      completedAt,
      timeSpentSeconds: null,
      percentage,
      totalScaledScore: null,
      rwScaledScore: null,
      mathScaledScore: null,
      totalScore,
      maxScore,
      correctCount: null,
      incorrectCount: null,
      unansweredCount: null,
      attemptNumberOnExam: 0,
      isLate: a.is_late === true,
      assignmentId: (a.assignment_id as string | null) ?? null,
    };
  });
}

async function fetchReports(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserReportItem[]> {
  const { data: rows, error } = await supabase
    .from("question_reports")
    .select(
      "id, exam_kind, upload_id, attempt_id, frq_upload_id, frq_attempt_id, reason_codes, custom_note, status, created_at"
    )
    .eq("user_email", email)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const reportList = rows ?? [];
  const mcqUploadIds = [
    ...new Set(
      reportList
        .filter((r) => (r.exam_kind as string) !== "frq" && r.upload_id)
        .map((r) => r.upload_id as string)
    ),
  ];
  const frqUploadIds = [
    ...new Set(
      reportList
        .filter((r) => (r.exam_kind as string) === "frq" && r.frq_upload_id)
        .map((r) => r.frq_upload_id as string)
    ),
  ];

  const [{ data: mcqUploads }, { data: frqUploads }] = await Promise.all([
    mcqUploadIds.length
      ? supabase.from("pdf_uploads").select("id, filename, display_title").in("id", mcqUploadIds)
      : Promise.resolve({ data: [] }),
    frqUploadIds.length
      ? supabase.from("frq_uploads").select("id, title, display_title").in("id", frqUploadIds)
      : Promise.resolve({ data: [] }),
  ]);

  const mcqTitleMap = new Map(
    (mcqUploads ?? []).map((u) => [
      u.id as string,
      resolveDisplayTitle(
        (u.display_title as string | null) ?? null,
        (u.filename as string | null) ?? "Exam"
      ),
    ])
  );
  const frqTitleMap = new Map(
    (frqUploads ?? []).map((u) => [
      u.id as string,
      resolveDisplayTitle(
        (u.display_title as string | null) ?? null,
        (u.title as string | null) ?? "FRQ Exam"
      ),
    ])
  );

  return reportList.map((r) => {
    const examKind = (r.exam_kind as string) === "frq" ? "frq" : "mcq";
    const uploadId =
      examKind === "frq" ? (r.frq_upload_id as string | null) : (r.upload_id as string | null);
    const attemptId =
      examKind === "frq" ? (r.frq_attempt_id as string | null) : (r.attempt_id as string | null);
    const examTitle =
      uploadId != null
        ? examKind === "frq"
          ? (frqTitleMap.get(uploadId) ?? "FRQ Exam")
          : (mcqTitleMap.get(uploadId) ?? "Exam")
        : "Unknown exam";

    return {
      id: r.id as string,
      examKind,
      uploadId,
      attemptId,
      examTitle,
      reasonCodes: Array.isArray(r.reason_codes) ? (r.reason_codes as string[]) : [],
      customNote: (r.custom_note as string | null) ?? null,
      status: String(r.status ?? "open"),
      createdAt: String(r.created_at ?? ""),
    };
  });
}

async function fetchClasses(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserClassItem[]> {
  const [{ data: memberships }, { data: teaching }] = await Promise.all([
    supabase
      .from("class_members")
      .select("class_id, joined_at")
      .eq("student_email", email)
      .order("joined_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, class_code, teacher_email, created_at, archived_at")
      .eq("teacher_email", email)
      .order("created_at", { ascending: false }),
  ]);

  const memberList = memberships ?? [];
  const memberClassIds = memberList.map((m) => String(m.class_id));

  const { data: memberClasses } = memberClassIds.length
    ? await supabase
        .from("classes")
        .select("id, name, class_code, teacher_email, archived_at")
        .in("id", memberClassIds)
    : { data: [] };

  const classMap = new Map((memberClasses ?? []).map((c) => [String(c.id), c]));
  const teacherEmails = [
    ...new Set(
      [...(memberClasses ?? []), ...(teaching ?? [])]
        .map((c) => normalizeEmail(c.teacher_email as string))
        .filter(Boolean)
    ),
  ];

  const { data: teachers } = teacherEmails.length
    ? await supabase.from("usertable").select("email, username").in("email", teacherEmails)
    : { data: [] };

  const teacherNames = new Map(
    (teachers ?? []).map((t) => [
      normalizeEmail(t.email as string),
      (t.username as string | null)?.trim() || String(t.email).split("@")[0] || "Teacher",
    ])
  );

  const studentItems: AdminUserClassItem[] = memberList
    .filter((m) => classMap.has(String(m.class_id)))
    .map((m) => {
      const cls = classMap.get(String(m.class_id))!;
      const teacherEmail = normalizeEmail(cls.teacher_email as string);
      return {
        id: String(cls.id),
        name: String(cls.name ?? "Class"),
        classCode: String(cls.class_code ?? ""),
        role: "student" as const,
        teacherEmail: teacherEmail || null,
        teacherName: teacherNames.get(teacherEmail) ?? null,
        joinedAt: (m.joined_at as string | null) ?? null,
        memberCount: null,
        assignmentCount: null,
        archived: cls.archived_at != null,
      };
    });

  const teacherItems: AdminUserClassItem[] = (teaching ?? []).map((cls) => ({
    id: String(cls.id),
    name: String(cls.name ?? "Class"),
    classCode: String(cls.class_code ?? ""),
    role: "teacher" as const,
    teacherEmail: email,
    teacherName: null,
    joinedAt: (cls.created_at as string | null) ?? null,
    memberCount: null,
    assignmentCount: null,
    archived: cls.archived_at != null,
  }));

  return [...studentItems, ...teacherItems];
}

async function fetchErrors(
  supabase: SupabaseClient,
  email: string
): Promise<AdminUserErrorItem[]> {
  const { data: rows, error } = await supabase
    .from("error_log_entries")
    .select(
      "id, source, error_name, message, page_url, endpoint, status, occurrence_count, last_seen_at"
    )
    .eq("user_email", email)
    .order("last_seen_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (rows ?? []).map((r) => ({
    id: String(r.id),
    source: r.source === "server" ? "server" : "client",
    errorName: String(r.error_name ?? ""),
    message: String(r.message ?? ""),
    pageUrl: (r.page_url as string | null) ?? null,
    endpoint: (r.endpoint as string | null) ?? null,
    status: String(r.status ?? "open"),
    occurrenceCount: typeof r.occurrence_count === "number" ? r.occurrence_count : 1,
    lastSeenAt: String(r.last_seen_at ?? ""),
  }));
}

export function isValidAdminUserActivityEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && isValidEmailFormat(normalized);
}

export async function buildAdminUserActivity(
  supabase: SupabaseClient,
  rawEmail: string,
  options?: BuildAdminUserActivityOptions
): Promise<AdminUserActivityPayload | null> {
  const email = normalizeEmail(rawEmail);
  if (!isValidAdminUserActivityEmail(email)) {
    throw new Error("Invalid email address.");
  }

  const profile = await fetchProfile(supabase, email);
  if (!profile) return null;

  const attemptsLimit = Math.min(Math.max(options?.attemptsLimit ?? 50, 1), 100);
  const attemptsOffset = Math.max(options?.attemptsOffset ?? 0, 0);

  const [mcqAttempts, frqAttempts, reports, classes, errors, insights] = await Promise.all([
    fetchMcqAttempts(supabase, email),
    fetchFrqAttempts(supabase, email),
    fetchReports(supabase, email),
    fetchClasses(supabase, email),
    fetchErrors(supabase, email),
    buildLibraryInsights(supabase, email),
  ]);

  const allAttempts = assignAttemptNumbers([...mcqAttempts, ...frqAttempts]);
  const attemptsTotal = allAttempts.length;
  const attempts = allAttempts.slice(attemptsOffset, attemptsOffset + attemptsLimit);

  const summary = computeSummary(allAttempts, reports.length, classes.length);

  return {
    profile,
    summary,
    insights,
    attempts,
    attemptsTotal,
    reports,
    classes,
    errors,
  };
}
