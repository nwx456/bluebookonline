"use client";

import { useCallback, useEffect, useState } from "react";
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
  Shield,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { ExamSourceEditor } from "@/components/admin/ExamSourceEditor";
import { canAdminEditExamSource, examHasSource } from "@/lib/exam-source-admin";
import type { ExamSourceType } from "@/lib/exam-source";
import { cn } from "@/lib/utils";

type ExamRow = {
  id: string;
  examKind: "mcq" | "frq";
  filename: string;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState("exam.pdf");

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
      setExams(Array.isArray(data.exams) ? data.exams : []);
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
      setActionId(exam.id);
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
        setActionId(null);
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
        ) : exams.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            {tab === "pending" ? labels.emptyPending : labels.emptyPublished}
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
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td className="max-w-[200px] truncate px-4 py-3 text-gray-900" title={exam.filename}>
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                        {exam.filename}
                        {exam.examKind === "frq" ? (
                          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-800">
                            FRQ
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{exam.subjectLabel}</td>
                    <td className="px-4 py-3 text-gray-600">{exam.examProgram}</td>
                    <td className="px-4 py-3 text-gray-600">{exam.questionCount}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{exam.username}</div>
                      <div className="font-mono text-xs text-gray-500">{exam.userEmail}</div>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-gray-600 align-top">
                      {isAdminVariant && accessToken ? (
                        <ExamSourceEditor
                          examId={exam.id}
                          examKind={exam.examKind}
                          accessToken={accessToken}
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
                            disabled={actionId === exam.id}
                            onClick={() => void openPreview(exam)}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            {labels.preview}
                          </button>
                        ) : null}
                        {tab === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={
                                actionId === exam.id ||
                                (isAdminVariant &&
                                  !examHasSource({
                                    sourceType: exam.sourceType,
                                    sourceName: exam.sourceName,
                                  }))
                              }
                              title={
                                isAdminVariant &&
                                !examHasSource({
                                  sourceType: exam.sourceType,
                                  sourceName: exam.sourceName,
                                })
                                  ? "Add source before approving"
                                  : undefined
                              }
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
                ))}
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
