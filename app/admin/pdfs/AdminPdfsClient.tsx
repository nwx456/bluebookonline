"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { ExamSourceEditor } from "@/components/admin/ExamSourceEditor";
import { ExamTitleEditor } from "@/components/admin/ExamTitleEditor";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/subjects";
import type { AnswerKeyKind } from "@/lib/answer-key-label";
import {
  getModerationStatusBadgeClass,
  getModerationStatusLabel,
} from "@/lib/exam-publish-utils";
import type { ExamSourceType } from "@/lib/exam-source";
import { cn } from "@/lib/utils";

type Recipient = { email: string; username: string };

type AdminPdfRow = {
  id: string;
  filename: string;
  storageFilename: string;
  displayTitle: string | null;
  subject: string;
  subjectLabel: string;
  examProgram: "AP" | "SAT";
  userEmail: string;
  username: string;
  questionCount: number;
  requestedQuestionCount: number | null;
  requestedQuestionCountSource: "stored" | "inferred" | "unknown";
  questionCountMismatch: boolean;
  answerKeyFromPdfCount: number | null;
  answerKeyLabel: string;
  answerKeyKind: AnswerKeyKind;
  answerKeyTitle: string;
  isPublished: boolean;
  moderationStatus: string;
  publishRequestedAt: string | null;
  sourceType: ExamSourceType | null;
  sourceName: string | null;
  sourceUrl: string | null;
  hasSource: boolean;
  canEditSource: boolean;
  createdAt: string;
  hasStoragePath: boolean;
};

const LIMIT = 50;

function answerKeyBadgeClass(kind: AnswerKeyKind): string {
  switch (kind) {
    case "pdf":
      return "bg-green-100 text-green-800";
    case "ai":
      return "bg-violet-100 text-violet-800";
    case "mixed":
      return "bg-amber-100 text-amber-800";
    case "unknown":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function AdminPdfsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [user, setUser] = useState("");
  const [program, setProgram] = useState("");
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filtersReady, setFiltersReady] = useState(false);

  const [pdfs, setPdfs] = useState<AdminPdfRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [userFilterOpen, setUserFilterOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const userSearchInputRef = useRef<HTMLInputElement>(null);
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    setSubject(searchParams.get("subject") ?? "");
    setUser(searchParams.get("user") ?? "");
    setProgram(searchParams.get("program") ?? "");
    setMismatchOnly(
      searchParams.get("mismatch") === "1" || searchParams.get("mismatch") === "true"
    );
    const raw = Number(searchParams.get("offset"));
    setOffset(Number.isFinite(raw) && raw >= 0 ? raw : 0);
    setFiltersReady(true);
  }, [searchParams]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      if (!isAdminBroadcastEmail(session.user.email)) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(session.access_token ?? null);
      setChecking(false);
    });
  }, [router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin/mail/recipients", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.recipients) ? data.recipients : [];
        setRecipients(
          list.map((r: { email?: string; username?: string }) => ({
            email: String(r.email ?? ""),
            username: String(r.username ?? ""),
          }))
        );
      })
      .catch(() => setRecipients([]));
  }, [accessToken]);

  const syncUrl = useCallback(
    (next: {
      q?: string;
      subject?: string;
      user?: string;
      program?: string;
      mismatch?: boolean;
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      const qVal = next.q ?? q;
      const subjectVal = next.subject ?? subject;
      const userVal = next.user ?? user;
      const programVal = next.program ?? program;
      const mismatchVal = next.mismatch ?? mismatchOnly;
      const offsetVal = next.offset ?? offset;

      if (qVal.trim()) params.set("q", qVal.trim());
      if (subjectVal) params.set("subject", subjectVal);
      if (userVal.trim()) params.set("user", userVal.trim());
      if (programVal === "AP" || programVal === "SAT") params.set("program", programVal);
      if (mismatchVal) params.set("mismatch", "1");
      if (offsetVal > 0) params.set("offset", String(offsetVal));

      const qs = params.toString();
      router.replace(qs ? `/admin/pdfs?${qs}` : "/admin/pdfs", { scroll: false });
    },
    [q, subject, user, program, mismatchOnly, offset, router]
  );

  const loadPdfs = useCallback(async () => {
    if (!accessToken) return;
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (subject) params.set("subject", subject);
      if (user.trim()) params.set("user", user.trim());
      if (program === "AP" || program === "SAT") params.set("program", program);
      if (mismatchOnly) params.set("mismatch", "1");
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));

      const res = await fetch(`/api/admin/pdfs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Could not load PDFs.");
        setPdfs([]);
        setTotal(0);
        return;
      }
      setPdfs(
        (Array.isArray(data.pdfs) ? data.pdfs : []).map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          filename: String(row.filename ?? "PDF"),
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
          subjectLabel: String(row.subjectLabel ?? row.subject ?? ""),
          examProgram: row.examProgram === "SAT" ? "SAT" : "AP",
          userEmail: String(row.userEmail ?? ""),
          username: String(row.username ?? "Anonymous"),
          questionCount: Number(row.questionCount) || 0,
          requestedQuestionCount:
            row.requestedQuestionCount != null && Number.isFinite(Number(row.requestedQuestionCount))
              ? Number(row.requestedQuestionCount)
              : null,
          requestedQuestionCountSource: (["stored", "inferred", "unknown"].includes(
            String(row.requestedQuestionCountSource)
          )
            ? row.requestedQuestionCountSource
            : "unknown") as "stored" | "inferred" | "unknown",
          questionCountMismatch: row.questionCountMismatch === true,
          answerKeyFromPdfCount:
            row.answerKeyFromPdfCount != null && Number.isFinite(Number(row.answerKeyFromPdfCount))
              ? Number(row.answerKeyFromPdfCount)
              : null,
          answerKeyLabel: String(row.answerKeyLabel ?? "Unknown"),
          answerKeyKind: (["pdf", "ai", "mixed", "unknown", "none"].includes(
            String(row.answerKeyKind)
          )
            ? row.answerKeyKind
            : "unknown") as AnswerKeyKind,
          answerKeyTitle: String(row.answerKeyTitle ?? ""),
          isPublished: row.isPublished === true,
          moderationStatus: String(row.moderationStatus ?? "draft"),
          publishRequestedAt:
            row.publishRequestedAt != null ? String(row.publishRequestedAt) : null,
          sourceType:
            row.sourceType === "book" ||
            row.sourceType === "agency" ||
            row.sourceType === "school"
              ? row.sourceType
              : null,
          sourceName: row.sourceName != null ? String(row.sourceName) : null,
          sourceUrl: row.sourceUrl != null ? String(row.sourceUrl) : null,
          hasSource: row.hasSource === true,
          canEditSource: row.canEditSource === true,
          createdAt: String(row.createdAt ?? ""),
          hasStoragePath: row.hasStoragePath === true,
        }))
      );
      setTotal(Number(data.total) || 0);
    } catch {
      setListError("Connection error.");
      setPdfs([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [accessToken, q, subject, user, program, mismatchOnly, offset]);

  useEffect(() => {
    if (!accessToken || checking || !filtersReady) return;
    loadPdfs();
  }, [accessToken, checking, filtersReady, loadPdfs]);

  const applyFilters = (resetOffset = true) => {
    const nextOffset = resetOffset ? 0 : offset;
    if (resetOffset) setOffset(0);
    syncUrl({ q, subject, user, program, offset: nextOffset });
  };

  const userFilterLabel = useMemo(() => {
    if (!user.trim()) return "All users";
    const match = recipients.find(
      (r) =>
        r.email.toLowerCase() === user.toLowerCase() ||
        r.username.toLowerCase() === user.toLowerCase()
    );
    if (match?.username) return `${match.username} (${match.email})`;
    return user;
  }, [user, recipients]);

  const filteredRecipients = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (r) =>
        r.email.toLowerCase().includes(term) ||
        r.username.toLowerCase().includes(term)
    );
  }, [recipients, userSearch]);

  useEffect(() => {
    if (userFilterOpen) {
      userSearchInputRef.current?.focus();
    } else {
      setUserSearch("");
    }
  }, [userFilterOpen]);

  const subjectFilterLabel = subject
    ? SUBJECT_LABELS[subject as SubjectKey] ?? subject
    : "All subjects";

  const handleSourceSaved = useCallback(
    (rowId: string, values: { sourceType: ExamSourceType | null; sourceName: string | null; sourceUrl: string | null }) => {
      setPdfs((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                sourceType: values.sourceType,
                sourceName: values.sourceName,
                sourceUrl: values.sourceUrl,
                hasSource: Boolean(values.sourceType && values.sourceName),
              }
            : row
        )
      );
    },
    []
  );

  const handleTitleSaved = useCallback(
    (rowId: string, displayTitle: string | null, displayName: string) => {
      setPdfs((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, displayTitle, filename: displayName } : row
        )
      );
    },
    []
  );

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + LIMIT, total);
  const canPrev = offset > 0;
  const canNext = offset + LIMIT < total;

  const fetchPdfUrl = async (id: string): Promise<{ url: string; filename: string } | null> => {
    if (!accessToken) return null;
    const res = await fetch(`/api/admin/pdfs/${id}/url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not get PDF link.");
    }
    if (!data.url) return null;
    return {
      url: String(data.url),
      filename: String(data.filename ?? "exam.pdf"),
    };
  };

  const handlePreview = async (row: AdminPdfRow) => {
    if (!row.hasStoragePath) return;
    setActionError(null);
    setActionLoadingId(row.id);
    try {
      const result = await fetchPdfUrl(row.id);
      if (!result) throw new Error("PDF link unavailable.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownload = async (row: AdminPdfRow) => {
    if (!row.hasStoragePath) return;
    setActionError(null);
    setActionLoadingId(row.id);
    try {
      const result = await fetchPdfUrl(row.id);
      if (!result) throw new Error("PDF link unavailable.");
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">PDF library</h1>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Search and filter uploaded exam PDFs by user and subject. Preview or download files to
          compare with extracted questions.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full flex-1 sm:min-w-[200px]">
            <label htmlFor="pdf-search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="pdf-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters(true);
                }}
                placeholder="Filename, email, or username"
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="relative w-full sm:min-w-[180px] sm:w-auto">
            <span className="block text-sm font-medium text-gray-700">User</span>
            <button
              type="button"
              onClick={() => setUserFilterOpen((o) => !o)}
              className={cn(
                "mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                "hover:bg-gray-50"
              )}
            >
              <span className="truncate text-left">{userFilterLabel}</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-gray-500", userFilterOpen && "rotate-180")}
              />
            </button>
            {userFilterOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close user filter"
                  onClick={() => setUserFilterOpen(false)}
                />
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="sticky top-0 border-b border-gray-100 bg-white p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        ref={userSearchInputRef}
                        type="search"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Search name or email…"
                        className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <ul className="max-h-52 overflow-auto py-1">
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                        !user && "bg-blue-50 text-blue-700"
                      )}
                      onClick={() => {
                        setUser("");
                        setUserFilterOpen(false);
                        syncUrl({ user: "", offset: 0 });
                        setOffset(0);
                      }}
                    >
                      All users
                    </button>
                  </li>
                  {filteredRecipients.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">No users found.</li>
                  ) : (
                  filteredRecipients.map((r) => (
                    <li key={r.email}>
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                          user === r.email && "bg-blue-50 text-blue-700"
                        )}
                        onClick={() => {
                          setUser(r.email);
                          setUserFilterOpen(false);
                          syncUrl({ user: r.email, offset: 0 });
                          setOffset(0);
                        }}
                      >
                        <span className="font-medium text-gray-900">
                          {r.username || r.email.split("@")[0]}
                        </span>
                        <span className="block text-xs text-gray-500">{r.email}</span>
                      </button>
                    </li>
                  ))
                  )}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="relative w-full sm:min-w-[180px] sm:w-auto">
            <span className="block text-sm font-medium text-gray-700">Subject</span>
            <button
              type="button"
              onClick={() => setSubjectFilterOpen((o) => !o)}
              className={cn(
                "mt-1 flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                "hover:bg-gray-50"
              )}
            >
              <span className="truncate text-left">{subjectFilterLabel}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-gray-500",
                  subjectFilterOpen && "rotate-180"
                )}
              />
            </button>
            {subjectFilterOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close subject filter"
                  onClick={() => setSubjectFilterOpen(false)}
                />
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                        !subject && "bg-blue-50 text-blue-700"
                      )}
                      onClick={() => {
                        setSubject("");
                        setSubjectFilterOpen(false);
                        syncUrl({ subject: "", offset: 0 });
                        setOffset(0);
                      }}
                    >
                      All subjects
                    </button>
                  </li>
                  {SUBJECT_KEYS.map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                          subject === key && "bg-blue-50 text-blue-700"
                        )}
                        onClick={() => {
                          setSubject(key);
                          setSubjectFilterOpen(false);
                          syncUrl({ subject: key, offset: 0 });
                          setOffset(0);
                        }}
                      >
                        {SUBJECT_LABELS[key]}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700">Program</span>
            <div className="mt-1 flex rounded-md border border-gray-200 p-0.5">
              {(["", "AP", "SAT"] as const).map((val) => (
                <button
                  key={val || "all"}
                  type="button"
                  onClick={() => {
                    setProgram(val);
                    syncUrl({ program: val, offset: 0 });
                    setOffset(0);
                  }}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    program === val
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {val || "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-gray-800 hover:bg-amber-50">
              <input
                type="checkbox"
                checked={mismatchOnly}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setMismatchOnly(checked);
                  setOffset(0);
                  syncUrl({ mismatch: checked, offset: 0 });
                }}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Count mismatch only
            </label>
          </div>

          <button
            type="button"
            onClick={() => applyFilters(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {actionError}
          </p>
        )}

        {listError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {listError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-gray-600">
          <span>
            {listLoading ? "Loading…" : `${total.toLocaleString()} PDF${total === 1 ? "" : "s"}`}
            {!listLoading && total > 0 && (
              <span className="text-gray-500">
                {" "}
                · showing {pageStart}–{pageEnd}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canPrev || listLoading}
              onClick={() => {
                const next = Math.max(0, offset - LIMIT);
                setOffset(next);
                syncUrl({ offset: next });
              }}
              className="rounded-md border border-gray-200 px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext || listLoading}
              onClick={() => {
                const next = offset + LIMIT;
                setOffset(next);
                syncUrl({ offset: next });
              }}
              className="rounded-md border border-gray-200 px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>

        {listLoading && pdfs.length === 0 ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading PDFs…
          </div>
        ) : pdfs.length === 0 ? (
          <p className="mt-6 py-12 text-center text-sm text-gray-500">
            {mismatchOnly
              ? "No PDFs with a count mismatch match your filters."
              : "No PDFs match your filters."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-gray-100">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium" scope="col">
                    File
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    User
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Subject
                  </th>
                  <th className="px-3 py-2 font-medium text-right" scope="col">
                    Entered
                  </th>
                  <th className="px-3 py-2 font-medium text-right" scope="col">
                    Extracted
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Answer key
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Moderation
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Source
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Uploaded
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pdfs.map((row) => {
                  const busy = actionLoadingId === row.id;
                  const zeroQuestions = row.questionCount === 0;
                  const showMismatch = row.questionCountMismatch || zeroQuestions;
                  return (
                    <tr key={row.id} className="bg-white">
                      <td className="max-w-[240px] px-3 py-2 align-top font-medium text-gray-900">
                        {accessToken ? (
                          <ExamTitleEditor
                            examId={row.id}
                            examKind="mcq"
                            accessToken={accessToken}
                            displayName={row.filename}
                            storageFilename={row.storageFilename}
                            displayTitle={row.displayTitle}
                            compact
                            onSaved={(displayTitle, displayName) =>
                              handleTitleSaved(row.id, displayTitle, displayName)
                            }
                          />
                        ) : (
                          row.filename
                        )}
                        {!row.hasStoragePath && (
                          <span className="ml-2 text-xs font-normal text-amber-600">No file</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        <div className="font-medium text-gray-900">{row.username}</div>
                        <div className="text-xs text-gray-500">{row.userEmail}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        <div>{row.subjectLabel}</div>
                        <div className="text-xs text-gray-500">{row.examProgram}</div>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          row.requestedQuestionCount == null
                            ? "text-gray-400"
                            : row.questionCountMismatch
                              ? "font-semibold text-amber-700"
                              : "text-gray-900"
                        )}
                      >
                        {row.requestedQuestionCount != null ? (
                          <>
                            {row.requestedQuestionCount}
                            {row.requestedQuestionCountSource === "inferred" && (
                              <span
                                className="ml-0.5 text-xs font-normal text-gray-400"
                                title="Estimated from filename (legacy upload)"
                              >
                                *
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                        <span className="block text-xs font-normal text-gray-500">
                          {row.requestedQuestionCountSource === "stored"
                            ? "user entered"
                            : row.requestedQuestionCountSource === "inferred"
                              ? "from filename"
                              : "not recorded"}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          showMismatch ? "font-semibold text-amber-700" : "text-gray-900"
                        )}
                      >
                        {row.questionCount}
                        {zeroQuestions && (
                          <span className="block text-xs font-normal text-amber-600">
                            Check extraction
                          </span>
                        )}
                        {row.questionCountMismatch && !zeroQuestions && (
                          <span className="block text-xs font-normal text-amber-600">
                            Count mismatch
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          title={row.answerKeyTitle}
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            answerKeyBadgeClass(row.answerKeyKind)
                          )}
                        >
                          {row.answerKeyLabel}
                        </span>
                        {row.answerKeyKind === "pdf" && (
                          <span className="mt-0.5 block text-xs text-gray-500">From PDF</span>
                        )}
                        {row.answerKeyKind === "ai" && (
                          <span className="mt-0.5 block text-xs text-gray-500">AI on attempt</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            getModerationStatusBadgeClass({
                              isPublished: row.isPublished,
                              moderationStatus: row.moderationStatus,
                            })
                          )}
                        >
                          {getModerationStatusLabel({
                            isPublished: row.isPublished,
                            moderationStatus: row.moderationStatus,
                          })}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {accessToken ? (
                          <ExamSourceEditor
                            examId={row.id}
                            examKind="mcq"
                            accessToken={accessToken}
                            examLabel={row.filename}
                            initialValues={{
                              sourceType: row.sourceType,
                              sourceName: row.sourceName,
                              sourceUrl: row.sourceUrl,
                            }}
                            disabled={!row.canEditSource}
                            compact
                            onSaved={(values) => handleSourceSaved(row.id, values)}
                          />
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={!row.hasStoragePath || busy}
                            onClick={() => handlePreview(row)}
                            title="Preview PDF"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            Preview
                          </button>
                          <button
                            type="button"
                            disabled={!row.hasStoragePath || busy}
                            onClick={() => handleDownload(row)}
                            title="Download PDF"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                          <a
                            href={`/exam/${row.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Questions
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
