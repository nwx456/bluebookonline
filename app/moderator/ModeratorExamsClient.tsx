"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Loader2,
  Search,
  Shield,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { ExamSourceEditor } from "@/components/admin/ExamSourceEditor";
import { ExamTitleEditor } from "@/components/admin/ExamTitleEditor";
import { canAdminEditExamSource, examHasSource } from "@/lib/exam-source-admin";
import type { ExamSourceType } from "@/lib/exam-source";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { cn } from "@/lib/utils";

type ExamRow = {
  id: string;
  examKind: "mcq" | "frq";
  filename: string;
  storageFilename: string;
  displayTitle: string | null;
  subject: string;
  subjectLabel: string;
  examProgram: "AP" | "SAT";
  userEmail: string;
  username: string;
  questionCount: number;
  isPublished: boolean;
  moderationStatus: string;
  publishRequestedAt: string | null;
  createdAt: string | null;
  hasStoragePath: boolean;
  sourceType: string | null;
  sourceTypeLabel: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  hasSource: boolean;
};

function parseExamSourceType(value: string | null): ExamSourceType | null {
  if (value === "book" || value === "agency" || value === "school") return value;
  return null;
}

function examCanEditSource(exam: ExamRow): boolean {
  return canAdminEditExamSource({
    isPublished: exam.isPublished,
    moderationStatus: exam.moderationStatus,
  });
}

type TabStatus = "pending" | "published";

type ModeratorExamsClientProps = {
  variant?: "moderator" | "admin";
};

const MODERATOR_LABELS = {
  back: "Dashboard'a git",
  title: "Moderatör Paneli",
  pendingTab: "Onay Bekleyen",
  publishedTab: "Yayındaki Sınavlar",
  emptyPending: "Onay bekleyen sınav yok.",
  emptyPublished: "Yayında sınav yok.",
  file: "Dosya",
  subject: "Ders",
  program: "Program",
  questions: "Sorular",
  uploader: "Yükleyen",
  source: "Kaynak",
  requestedAt: "İstek tarihi",
  uploadedAt: "Yüklenme",
  actions: "İşlem",
  preview: "Önizle",
  approve: "Onayla",
  reject: "Reddet",
  unpublish: "Yayından kaldır",
  newTab: "Yeni sekme",
  download: "İndir",
  close: "Kapat",
  listError: "Liste yüklenemedi.",
  connectionError: "Bağlantı hatası.",
  actionFailed: "İşlem başarısız.",
  pdfError: "PDF açılamadı.",
  searchPlaceholder: "İsme göre ara…",
  allSubjects: "Tüm dersler",
  allPrograms: "Tüm programlar",
  noFilterResults: "Filtrelere uyan sınav yok.",
  approveNeedsSource: "Onaylamadan önce kaynak ekleyin",
} as const;

const ADMIN_LABELS = {
  back: "Back to Admin Mail",
  title: "Exam Approval",
  pendingTab: "Pending Approval",
  publishedTab: "Published Exams",
  emptyPending: "No exams pending approval.",
  emptyPublished: "No published exams.",
  file: "File",
  subject: "Subject",
  program: "Program",
  questions: "Questions",
  uploader: "Uploader",
  source: "Source",
  requestedAt: "Requested",
  uploadedAt: "Uploaded",
  actions: "Actions",
  preview: "Preview",
  approve: "Approve",
  reject: "Reject",
  unpublish: "Unpublish",
  newTab: "New tab",
  download: "Download",
  close: "Close",
  listError: "Failed to load list.",
  connectionError: "Connection error.",
  actionFailed: "Action failed.",
  pdfError: "Could not open PDF.",
  searchPlaceholder: "Search by name…",
  allSubjects: "All subjects",
  allPrograms: "All programs",
  noFilterResults: "No exams match your filters.",
  approveNeedsSource: "Add source before approving",
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function ModeratorExamsClient({
  variant = "moderator",
}: ModeratorExamsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdminVariant = variant === "admin";
  const basePath = isAdminVariant ? "/admin/moderation" : "/moderator";
  const backHref = isAdminVariant ? "/admin/mail" : "/dashboard";
  const labels = isAdminVariant ? ADMIN_LABELS : MODERATOR_LABELS;

  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabStatus>(
    searchParams.get("status") === "published" ? "published" : "pending"
  );
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("exam.pdf");
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [subjectFilter, setSubjectFilter] = useState(() => searchParams.get("subject") ?? "");
  const [programFilter, setProgramFilter] = useState(() => searchParams.get("program") ?? "");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      const token = session.access_token ?? "";

      if (isAdminVariant) {
        if (!isAdminBroadcastEmail(session.user.email)) {
          router.replace("/dashboard");
          return;
        }
        setAccessToken(token);
        setChecking(false);
        return;
      }

      const res = await fetch("/api/moderator/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(token);
      setChecking(false);
    });
  }, [router, isAdminVariant]);

  const loadExams = useCallback(async (token: string, status: TabStatus) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/moderator/exams?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : labels.listError);
        setExams([]);
        return;
      }
      setExams(
        (Array.isArray(data.exams) ? data.exams : []).map((row: Record<string, unknown>) => {
          const sourceType =
            typeof row.sourceType === "string"
              ? row.sourceType
              : row.sourceType === null
                ? null
                : null;
          const sourceName =
            typeof row.sourceName === "string"
              ? row.sourceName
              : row.sourceName === null
                ? null
                : null;
          return {
            ...(row as ExamRow),
            storageFilename:
              typeof row.storageFilename === "string"
                ? row.storageFilename
                : String(row.filename ?? "PDF"),
            displayTitle:
              typeof row.displayTitle === "string"
                ? row.displayTitle
                : row.displayTitle === null
                  ? null
                  : null,
            subject: String(row.subject ?? ""),
            hasSource:
              row.hasSource === true ||
              examHasSource({ sourceType, sourceName }),
          };
        })
      );
    } catch {
      setListError(labels.connectionError);
      setExams([]);
    } finally {
      setListLoading(false);
    }
  }, [labels.connectionError, labels.listError]);

  useEffect(() => {
    if (!accessToken || checking) return;
    void loadExams(accessToken, tab);
  }, [accessToken, checking, tab, loadExams]);

  const setTabAndUrl = useCallback(
    (next: TabStatus) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", next);
      router.replace(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  const syncFiltersToUrl = useCallback(
    (next: { q?: string; subject?: string; program?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const qVal = next.q ?? q;
      const subjectVal = next.subject ?? subjectFilter;
      const programVal = next.program ?? programFilter;
      if (qVal.trim()) params.set("q", qVal.trim());
      else params.delete("q");
      if (subjectVal) params.set("subject", subjectVal);
      else params.delete("subject");
      if (programVal === "AP" || programVal === "SAT") params.set("program", programVal);
      else params.delete("program");
      router.replace(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath, q, subjectFilter, programFilter]
  );

  const filteredExams = useMemo(() => {
    const term = q.trim().toLowerCase();
    return exams.filter((exam) => {
      if (subjectFilter && exam.subject !== subjectFilter) return false;
      if (programFilter === "AP" && exam.examProgram !== "AP") return false;
      if (programFilter === "SAT" && exam.examProgram !== "SAT") return false;
      if (!term) return true;
      const haystack = [
        exam.filename,
        exam.storageFilename,
        exam.displayTitle ?? "",
        exam.subjectLabel,
        exam.username,
        exam.userEmail,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [exams, q, subjectFilter, programFilter]);

  const handleTitleSaved = useCallback((examId: string, displayTitle: string | null, displayName: string) => {
    setExams((prev) =>
      prev.map((exam) =>
        exam.id === examId
          ? { ...exam, displayTitle, filename: displayName }
          : exam
      )
    );
  }, []);

  const runAction = useCallback(
    async (exam: ExamRow, action: "approve" | "reject" | "unpublish") => {
      if (!accessToken) return;
      setActionId(exam.id);
      setListError(null);
      try {
        const kindParam = exam.examKind === "frq" ? "?examKind=frq" : "";
        const res = await fetch(`/api/moderator/exams/${exam.id}/${action}${kindParam}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setListError(typeof data.error === "string" ? data.error : labels.actionFailed);
          return;
        }
        await loadExams(accessToken, tab);
      } catch {
        setListError(labels.connectionError);
      } finally {
        setActionId(null);
      }
    },
    [accessToken, tab, loadExams, labels.actionFailed, labels.connectionError]
  );

  const handleSourceSaved = useCallback(
    (
      examId: string,
      values: { sourceType: ExamSourceType | null; sourceName: string | null; sourceUrl: string | null }
    ) => {
      setExams((prev) =>
        prev.map((exam) =>
          exam.id === examId
            ? {
                ...exam,
                sourceType: values.sourceType,
                sourceName: values.sourceName,
                sourceUrl: values.sourceUrl,
                sourceTypeLabel: values.sourceType
                  ? values.sourceType === "book"
                    ? "Book"
                    : values.sourceType === "agency"
                      ? "Agency"
                      : "School"
                  : null,
                hasSource: examHasSource({
                  sourceType: values.sourceType,
                  sourceName: values.sourceName,
                }),
              }
            : exam
        )
      );
    },
    []
  );

  const openPreview = useCallback(
    async (exam: ExamRow) => {
      if (!accessToken) return;
      setPreviewLoadingId(exam.id);
      try {
        const kindParam = exam.examKind === "frq" ? "?examKind=frq" : "";
        const res = await fetch(`/api/moderator/exams/${exam.id}/url${kindParam}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setListError(typeof data.error === "string" ? data.error : labels.pdfError);
          return;
        }
        setPreviewUrl(data.url as string);
        setPreviewFilename((data.filename as string) ?? "exam.pdf");
      } catch {
        setListError(labels.connectionError);
      } finally {
        setPreviewLoadingId(null);
      }
    },
    [accessToken, labels.connectionError, labels.pdfError]
  );

  if (checking) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-hidden />
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" aria-hidden />
          <h1 className="text-xl font-semibold text-gray-900">{labels.title}</h1>
        </div>
        <Link
          href={backHref}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {labels.back}
        </Link>
      </div>

      {!isAdminVariant ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/moderator/reports"
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            <Flag className="h-4 w-4 shrink-0" aria-hidden />
            Reported Questions Inbox
          </Link>
          <Link
            href="/moderator/resources"
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 hover:bg-blue-100"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Resource Moderation
          </Link>
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTabAndUrl("pending")}
          className={cn(
            "min-h-[44px] border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "pending"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          {labels.pendingTab}
        </button>
        <button
          type="button"
          onClick={() => setTabAndUrl("published")}
          className={cn(
            "min-h-[44px] border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "published"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          {labels.publishedTab}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") syncFiltersToUrl({ q: e.currentTarget.value });
              }}
              placeholder={labels.searchPlaceholder}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Subject</span>
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              syncFiltersToUrl({ subject: e.target.value });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{labels.allSubjects}</option>
            {SUBJECT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SUBJECT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[120px] flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Program</span>
          <select
            value={programFilter}
            onChange={(e) => {
              setProgramFilter(e.target.value);
              syncFiltersToUrl({ program: e.target.value });
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{labels.allPrograms}</option>
            <option value="AP">AP</option>
            <option value="SAT">SAT</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => syncFiltersToUrl({ q })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </p>
      ) : null}

      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        {listLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
          </div>
        ) : filteredExams.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            {exams.length === 0
              ? tab === "pending"
                ? labels.emptyPending
                : labels.emptyPublished
              : labels.noFilterResults}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.file}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.subject}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.program}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.questions}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.uploader}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">{labels.source}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    {tab === "pending" ? labels.requestedAt : labels.uploadedAt}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">{labels.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExams.map((exam) => {
                  const approveBlocked = !exam.hasSource;
                  return (
                  <tr key={exam.id}>
                    <td className="max-w-[240px] px-4 py-3 align-top text-gray-900">
                      <div className="inline-flex items-start gap-1.5">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          {accessToken ? (
                            <ExamTitleEditor
                              examId={exam.id}
                              examKind={exam.examKind}
                              accessToken={accessToken}
                              displayName={exam.filename}
                              storageFilename={exam.storageFilename}
                              displayTitle={exam.displayTitle}
                              compact
                              onSaved={(displayTitle, displayName) =>
                                handleTitleSaved(exam.id, displayTitle, displayName)
                              }
                            />
                          ) : (
                            <span className="truncate font-medium">{exam.filename}</span>
                          )}
                          {exam.examKind === "frq" ? (
                            <span className="mt-1 inline-flex rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-800">
                              FRQ
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{exam.subjectLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{exam.examProgram}</td>
                    <td className="px-4 py-3 text-gray-600">{exam.questionCount}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{exam.username}</div>
                      <div className="font-mono text-xs text-gray-500">{exam.userEmail}</div>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-gray-600 align-top">
                      {accessToken ? (
                        <ExamSourceEditor
                          examId={exam.id}
                          examKind={exam.examKind}
                          accessToken={accessToken}
                          apiScope="moderator"
                          examLabel={exam.filename}
                          initialValues={{
                            sourceType: parseExamSourceType(exam.sourceType),
                            sourceName: exam.sourceName,
                            sourceUrl: exam.sourceUrl,
                          }}
                          disabled={!examCanEditSource(exam)}
                          compact
                          onSaved={(values) => handleSourceSaved(exam.id, values)}
                        />
                      ) : exam.sourceTypeLabel && exam.sourceName ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-800">
                            {exam.sourceTypeLabel}: {exam.sourceName}
                          </div>
                          {exam.sourceUrl ? (
                            <a
                              href={exam.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              Source link
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">No link</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tab === "pending"
                        ? formatDate(exam.publishRequestedAt)
                        : formatDate(exam.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {exam.hasStoragePath ? (
                          <button
                            type="button"
                            disabled={previewLoadingId === exam.id}
                            onClick={() => void openPreview(exam)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {previewLoadingId === exam.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {labels.preview}
                          </button>
                        ) : null}
                        {tab === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionId === exam.id || approveBlocked}
                              title={approveBlocked ? labels.approveNeedsSource : undefined}
                              onClick={() => void runAction(exam, "approve")}
                              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {actionId === exam.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              )}
                              {labels.approve}
                            </button>
                            <button
                              type="button"
                              disabled={actionId === exam.id}
                              onClick={() => void runAction(exam, "reject")}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                              {labels.reject}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={actionId === exam.id}
                            onClick={() => void runAction(exam, "unpublish")}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                          >
                            {actionId === exam.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : null}
                            {labels.unpublish}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewUrl(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="truncate text-sm font-semibold text-gray-900">{previewFilename}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {labels.newTab}
                </a>
                <a
                  href={previewUrl}
                  download={previewFilename}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {labels.download}
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {labels.close}
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title={previewFilename}
              className="min-h-[60vh] w-full flex-1"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
