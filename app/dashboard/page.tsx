"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
  BookOpen,
  X,
  AlertTriangle,
  Brain,
  Lightbulb,
  ImageIcon,
  Clock,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { cn, generateId } from "@/lib/utils";
import {
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import {
  SUBJECT_KEYS,
  SUBJECT_LABELS,
  SUBJECT_DEFAULT_HAS_VISUALS,
  isCodeSubject,
  type SubjectKey,
} from "@/lib/gemini-prompts";
import {
  getExamProgram,
  isSatFullTest,
  isSatMath,
  isSatRw,
  isSatSectionUpload,
  isSatSubject,
  SAT_MODULES,
  type SatAdaptiveMode,
  type SatFormat,
  type SatModuleId,
} from "@/lib/exam-program";
import {
  getModuleDisplayNumber,
  getSatModuleGroups,
} from "@/lib/sat-question-display";
import {
  formatMathTextIfNeeded,
  shouldFormatMathNotation,
} from "@/lib/math-notation-display";
import {
  defaultSatModuleCounts,
  getSatUploadModuleFields,
  parseSatModuleQuestionCounts,
  sumModuleCounts,
} from "@/lib/sat-upload-module-fields";
import { useProgram } from "@/lib/use-program";
import { UploadAnalyzeProgress, type PhaseTiming } from "@/components/UploadAnalyzeProgress";
import {
  buildClientAnalyzePhases,
  formatFriendlyAnalyzeError,
  PHASE_UPLOAD,
  PHASE_EXTRACT,
  PHASE_SAVE,
  type AnalyzeErrorDisplay,
  type AnalyzePhase,
  type ProgressEvent,
} from "@/lib/upload-analyze-progress";

const SUBJECTS = SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] }));
const SUBJECTS_FILTER = [
  { value: "" as const, label: "All subjects" },
  ...SUBJECTS,
];
const AP_SUBJECT_OPTIONS = SUBJECTS.filter((s) => getExamProgram(s.value) === "AP");

function formatSatModuleCounts(moduleCounts: Partial<Record<SatModuleId, number>>): string {
  return SAT_MODULES.map((mod) => `${mod.shortLabel}: ${moduleCounts[mod.id] ?? 0}`).join(" | ");
}
const SAT_SUBJECT_OPTIONS = SUBJECTS.filter((s) => getExamProgram(s.value) === "SAT");

const UNPUBLISH_CONFIRM_COOLDOWN_SEC = 3;

type SubjectValue = SubjectKey;

interface UploadedExam {
  id: string;
  name: string;
  subject: SubjectValue;
  examProgram: "AP" | "SAT";
  questionCount: number;
  uploadedAt: string;
  isPublished: boolean;
}

interface ModuleProgressEntry {
  correct: number;
  total: number;
}

interface RecentAttempt {
  id: string;
  uploadId: string;
  filename: string;
  subject: string;
  examProgram?: "AP" | "SAT";
  completedAt: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount?: number;
  notGradedCount?: number;
  skipAiGrading?: boolean;
  totalQuestions: number;
  percentage: number | null;
  moduleProgress?: Record<string, ModuleProgressEntry> | null;
  rwScaledScore?: number | null;
  mathScaledScore?: number | null;
  totalScaledScore?: number | null;
}

interface InProgressAttempt {
  id: string;
  uploadId: string;
  filename: string;
  subject: string;
  examProgram?: "AP" | "SAT";
  startedAt: string;
  timeSpentSeconds: number;
}

interface AttemptQuestion {
  id: string;
  question_number: number;
  question_text: string;
  passage_text: string | null;
  precondition_text?: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  sat_section?: "rw" | "math" | null;
  sat_module?: number | null;
  sat_module_variant?: "easy" | "hard" | null;
}

interface AttemptBreakdownRow {
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
}

interface ExpandedAttemptData {
  upload: {
    id: string;
    subject: string;
    filename: string;
    sat_format?: string | null;
    sat_adaptive_mode?: string | null;
  };
  questions: AttemptQuestion[];
  result: { breakdown: AttemptBreakdownRow[] };
}

/**
 * Compact SAT results summary shown at the top of the expanded attempt view.
 * Renders scaled scores and a module-by-module accordion with correct/total,
 * wrong count, unanswered count, and per-module percentage.
 */
function SatAttemptSummary(props: {
  attempt: RecentAttempt;
  groups: ReturnType<typeof getSatModuleGroups>;
  wrongAnswers: AttemptBreakdownRow[];
}) {
  const { attempt, groups, wrongAnswers } = props;
  const wrongByQuestion = useMemo(
    () => new Set(wrongAnswers.map((w) => w.questionNumber)),
    [wrongAnswers]
  );

  const showScaled = attempt.totalScaledScore != null;

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-white p-3 shadow-sm">
      {showScaled && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-gray-900 tabular-nums">
              {attempt.totalScaledScore}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              total scaled
            </span>
          </div>
          {attempt.rwScaledScore != null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-gray-800 tabular-nums">
                {attempt.rwScaledScore}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                R&amp;W
              </span>
            </div>
          )}
          {attempt.mathScaledScore != null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-gray-800 tabular-nums">
                {attempt.mathScaledScore}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Math
              </span>
            </div>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Module breakdown
          </p>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {groups.map((group) => {
              const total = group.questions.length;
              // group.id is "rw1", "rw2", "math1", "math2" OR "rw2-easy"/"rw2-hard" when
              // six_module variants are present. module_progress keys are just section+module.
              const progressKey = group.id.split("-")[0];
              const progress = attempt.moduleProgress?.[progressKey];
              const wrongCount = group.questions.filter((gq) =>
                wrongByQuestion.has(gq.question_number)
              ).length;
              const correct = progress?.correct ?? Math.max(0, total - wrongCount);
              const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
              return (
                <details key={group.id} className="bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">
                      {correct} / {total} · {percent}% · {wrongCount} wrong
                    </span>
                  </summary>
                  <div className="px-3 py-2 text-xs text-gray-600 bg-gray-50/50 border-t border-gray-100">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Correct</div>
                        <div className="font-semibold text-gray-900 tabular-nums">{correct}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Total</div>
                        <div className="font-semibold text-gray-900 tabular-nums">{total}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Wrong</div>
                        <div className="font-semibold text-red-600 tabular-nums">{wrongCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Percent</div>
                        <div className="font-semibold text-gray-900 tabular-nums">{percent}%</div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { program } = useProgram();
  const isProgramSat = program === "SAT";
  const [subject, setSubject] = useState<SubjectValue | "">("");
  const [hasVisualsInPdf, setHasVisualsInPdf] = useState<boolean | null>(null);
  const [questionCount, setQuestionCount] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showAnalyzeProgress, setShowAnalyzeProgress] = useState(false);
  const [analyzePhases, setAnalyzePhases] = useState<AnalyzePhase[]>([]);
  const [phaseTimings, setPhaseTimings] = useState<Record<string, PhaseTiming>>({});
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [overallStartedAt, setOverallStartedAt] = useState<number | null>(null);
  const [totalPredictedLabel, setTotalPredictedLabel] = useState<string | undefined>();
  const [analyzeError, setAnalyzeError] = useState<AnalyzeErrorDisplay | null>(null);
  const progressPanelRef = useRef<HTMLDivElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessDetail, setUploadSuccessDetail] = useState<string | null>(null);
  const [uploadModeWarning, setUploadModeWarning] = useState<string | null>(null);
  const [uploadModuleCountWarning, setUploadModuleCountWarning] = useState<string | null>(null);
  const [uploadStructureSummary, setUploadStructureSummary] = useState<string | null>(null);
  const [satModuleCounts, setSatModuleCounts] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<UploadedExam[]>([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<SubjectValue | "">("");
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const [unpublishTarget, setUnpublishTarget] = useState<UploadedExam | null>(null);
  const [unpublishCooldownSec, setUnpublishCooldownSec] = useState(0);
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [inProgressAttempts, setInProgressAttempts] = useState<InProgressAttempt[]>([]);
  const [deletingInProgressId, setDeletingInProgressId] = useState<string | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [continuingExamsOpen, setContinuingExamsOpen] = useState(true);
  const [recentExamsOpen, setRecentExamsOpen] = useState(true);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [expandedAttemptData, setExpandedAttemptData] = useState<ExpandedAttemptData | null>(null);
  const [expandedAttemptLoading, setExpandedAttemptLoading] = useState(false);
  const [selectedWrongQuestion, setSelectedWrongQuestion] = useState<number | null>(null);
  const [wrongResultViewMode, setWrongResultViewMode] = useState<"explanation" | "question">("question");
  const [wrongResultExplanation, setWrongResultExplanation] = useState<string | null>(null);
  const [wrongResultExplanationLoading, setWrongResultExplanationLoading] = useState(false);

  // SAT-specific upload state
  const [satAdaptiveMode, setSatAdaptiveMode] = useState<SatAdaptiveMode>("none");
  const [satCutoffRw, setSatCutoffRw] = useState<string>("");
  const [satCutoffMath, setSatCutoffMath] = useState<string>("");
  const [satSectionFormat, setSatSectionFormat] = useState<SatFormat>("single_module");

  const isSat = isSatSubject(subject || null);
  const isSatFull = isSatFullTest(subject || null);
  const isSatSection = isSatSectionUpload(subject || null);
  const usesSatModuleUpload =
    isSatFull || (isSatSection && satSectionFormat === "section_test");
  const isCode = subject !== "" && !isSat && isCodeSubject(subject as SubjectKey);

  const satUploadFormat: SatFormat = isSatFull
    ? "full_test"
    : isSatSection && satSectionFormat === "section_test"
      ? "section_test"
      : "single_module";

  const satModuleFields = useMemo(() => {
    if (!isProgramSat || !subject) return [];
    return getSatUploadModuleFields({
      subject,
      satFormat: satUploadFormat,
      satAdaptiveMode: usesSatModuleUpload ? satAdaptiveMode : "none",
    });
  }, [isProgramSat, subject, satUploadFormat, usesSatModuleUpload, satAdaptiveMode]);

  useEffect(() => {
    if (satModuleFields.length === 0) return;
    const defaults = defaultSatModuleCounts(satModuleFields);
    setSatModuleCounts((prev) => {
      const next: Record<string, string> = {};
      for (const field of satModuleFields) {
        const existing = prev[field.key];
        const n = parseInt(existing ?? "", 10);
        next[field.key] =
          Number.isInteger(n) && n >= 1 && n <= 99 ? existing! : String(defaults[field.key]);
      }
      return next;
    });
  }, [satModuleFields]);

  const parsedSatModuleCounts = useMemo(() => {
    if (!isProgramSat || satModuleFields.length === 0) return null;
    const raw: Record<string, unknown> = {};
    for (const field of satModuleFields) {
      raw[field.key] = satModuleCounts[field.key];
    }
    return parseSatModuleQuestionCounts(raw, satModuleFields);
  }, [isProgramSat, satModuleFields, satModuleCounts]);

  const questionCountNum = parseInt(questionCount, 10);
  const isQuestionCountValid = Number.isInteger(questionCountNum) && questionCountNum >= 1;
  const effectiveQuestionCount = isProgramSat
    ? parsedSatModuleCounts
      ? sumModuleCounts(parsedSatModuleCounts)
      : NaN
    : isQuestionCountValid
      ? questionCountNum
      : NaN;
  const isQuestionCountValidEffective = isProgramSat
    ? parsedSatModuleCounts !== null
    : isQuestionCountValid;

  const uploadSubjectOptions = isProgramSat ? SAT_SUBJECT_OPTIONS : AP_SUBJECT_OPTIONS;

  const pdfTooLarge =
    selectedFile !== null && selectedFile.size > MAX_PDF_UPLOAD_BYTES;
  const canAnalyze =
    selectedFile !== null &&
    !pdfTooLarge &&
    isQuestionCountValidEffective &&
    subject !== "" &&
    (isCode || hasVisualsInPdf !== null);

  useEffect(() => {
    setSubjectFilter("");
  }, [program]);

  useEffect(() => {
    if (!subject) return;
    const subjectProgram = getExamProgram(subject as SubjectKey);
    if (subjectProgram !== program) {
      setSubject("");
      setHasVisualsInPdf(null);
      setQuestionCount("");
      setSatSectionFormat("single_module");
    }
  }, [program, subject]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setCheckingAuth(false);
        router.replace("/login");
        return;
      }
      const email = session.user.email ?? "";
      if (isAdminBroadcastEmail(email)) {
        router.replace("/admin/mail");
        return;
      }
      setUserEmail(email);
      setAccessToken(session.access_token ?? null);
      const uname = (session.user?.user_metadata?.username as string)?.trim();
      setUserDisplayName(uname || email?.split("@")[0] || "Account");
      setCheckingAuth(false);
      supabase
        .from("pdf_uploads")
        .select("id, filename, subject, exam_program, created_at, is_published")
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .then(async ({ data: rows, error }) => {
          if (error) return;
          if (!rows?.length) {
            setUploads([]);
            return;
          }
          const ids = rows.map((r) => r.id);
          let countByUpload: Record<string, number> = {};
          try {
            countByUpload = await countQuestionsByUploadIds(supabase, ids);
          } catch {
            countByUpload = {};
          }
          setUploads(
            rows.map((row) => ({
              id: row.id,
              name: row.filename ?? "PDF",
              subject: (row.subject ?? "AP_CSA") as SubjectValue,
              examProgram:
                (row as { exam_program?: string | null }).exam_program === "SAT"
                  ? "SAT"
                  : "AP",
              questionCount: countByUpload[row.id] ?? 0,
              uploadedAt: row.created_at ?? new Date().toISOString(),
              isPublished: row.is_published === true,
            }))
          );
        });
    });
  }, [router]);

  useEffect(() => {
    if (!accessToken || pathname !== "/dashboard") return;
    fetch("/api/exams/recent", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.attempts) setRecentAttempts(res.attempts);
      });
    fetch("/api/exams/in-progress", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.attempts) setInProgressAttempts(res.attempts);
      });
  }, [accessToken, pathname]);

  useEffect(() => {
    if (!unpublishTarget) {
      setUnpublishCooldownSec(0);
      return;
    }
    setUnpublishCooldownSec(UNPUBLISH_CONFIRM_COOLDOWN_SEC);
    const interval = setInterval(() => {
      setUnpublishCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [unpublishTarget]);

  useEffect(() => {
    if (!expandedAttemptId || !accessToken) {
      setExpandedAttemptData(null);
      return;
    }
    setExpandedAttemptLoading(true);
    setSelectedWrongQuestion(null);
    setWrongResultExplanation(null);
    fetch(`/api/exam/attempt/${expandedAttemptId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setExpandedAttemptData(null);
          return;
        }
        setExpandedAttemptData({
          upload: data.upload,
          questions: data.questions ?? [],
          result: { breakdown: data.result?.breakdown ?? [] },
        });
      })
      .finally(() => setExpandedAttemptLoading(false));
  }, [expandedAttemptId, accessToken]);

  const handleDiscardInProgress = useCallback(
    async (attemptId: string) => {
      if (!accessToken) return;
      if (
        !confirm(
          "Discard this in-progress exam? Saved answers for this attempt will be removed. The PDF is not deleted."
        )
      ) {
        return;
      }
      setDeletingInProgressId(attemptId);
      try {
        const res = await fetch(`/api/exam/attempt/${attemptId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((data.error as string) ?? "Failed to discard.");
          return;
        }
        setInProgressAttempts((prev) => prev.filter((x) => x.id !== attemptId));
      } finally {
        setDeletingInProgressId(null);
      }
    },
    [accessToken]
  );

  const handleDeleteAttempt = useCallback(
    async (attemptId: string) => {
      if (!accessToken) return;
      if (
        !confirm(
          "Remove this attempt from your recent list? The exam PDF is not deleted."
        )
      ) {
        return;
      }
      setDeletingAttemptId(attemptId);
      try {
        const res = await fetch(`/api/exam/attempt/${attemptId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((data.error as string) ?? "Failed to delete attempt.");
          return;
        }
        setRecentAttempts((prev) => prev.filter((x) => x.id !== attemptId));
        if (expandedAttemptId === attemptId) {
          setExpandedAttemptId(null);
          setExpandedAttemptData(null);
        }
      } finally {
        setDeletingAttemptId(null);
      }
    },
    [accessToken, expandedAttemptId]
  );

  const handleWrongRowClick = useCallback((questionNumber: number) => {
    setSelectedWrongQuestion(questionNumber);
    setWrongResultViewMode("question");
    setWrongResultExplanation(null);
    setWrongResultExplanationLoading(false);
  }, []);

  const loadWrongExplanation = useCallback(
    async (questionNumber: number) => {
      const data = expandedAttemptData;
      if (!data) return;
      const q = data.questions.find((qq) => qq.question_number === questionNumber);
      const row = data.result.breakdown.find((b) => b.questionNumber === questionNumber);
      if (!q || !row) return;
      setSelectedWrongQuestion(questionNumber);
      setWrongResultViewMode("explanation");
      setWrongResultExplanationLoading(true);
      setWrongResultExplanation(null);
      try {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
          (o): o is string => o != null && String(o).trim() !== ""
        );
        const res = await fetch("/api/exam/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: q.question_text,
            passageText: q.passage_text ?? "",
            options: opts,
            correctAnswer: row.correctAnswer ?? "A",
            subject: data.upload.subject,
          }),
        });
        const json = await res.json();
        setWrongResultExplanation(json.explanation ?? "No explanation available.");
      } catch {
        setWrongResultExplanation("Failed to load explanation.");
      } finally {
        setWrongResultExplanationLoading(false);
      }
    },
    [expandedAttemptData]
  );

  const handleWrongQuestionClick = useCallback(
    async (questionNumber: number) => {
      const data = expandedAttemptData;
      if (!data) return;
      if (getExamProgram(data.upload.subject) === "SAT") {
        handleWrongRowClick(questionNumber);
        return;
      }
      const q = data.questions.find((qq) => qq.question_number === questionNumber);
      const row = data.result.breakdown.find((b) => b.questionNumber === questionNumber);
      if (!q || !row) return;
      setSelectedWrongQuestion(questionNumber);
      setWrongResultViewMode("explanation");
      setWrongResultExplanationLoading(true);
      setWrongResultExplanation(null);
      try {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
          (o): o is string => o != null && String(o).trim() !== ""
        );
        const res = await fetch("/api/exam/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: q.question_text,
            passageText: q.passage_text ?? "",
            options: opts,
            correctAnswer: row.correctAnswer ?? "A",
            subject: data.upload.subject,
          }),
        });
        const json = await res.json();
        setWrongResultExplanation(json.explanation ?? "No explanation available.");
      } catch {
        setWrongResultExplanation("Failed to load explanation.");
      } finally {
        setWrongResultExplanationLoading(false);
      }
    },
    [expandedAttemptData, handleWrongRowClick]
  );

  const closeUnpublishModal = useCallback(() => {
    setUnpublishTarget(null);
  }, []);

  const applyPublishChange = useCallback(async (exam: UploadedExam, newPublished: boolean) => {
    setTogglingPublishId(exam.id);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/upload/${exam.id}/publish`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPublished: newPublished }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError((data.error as string) || "Failed to update publish status.");
        return;
      }
      setUploads((prev) =>
        prev.map((u) => (u.id === exam.id ? { ...u, isPublished: newPublished } : u))
      );
    } finally {
      setTogglingPublishId(null);
    }
  }, []);

  const handlePublishToggleClick = useCallback(
    async (exam: UploadedExam) => {
      const newVal = !exam.isPublished;
      if (!newVal) {
        setUnpublishTarget(exam);
        return;
      }
      await applyPublishChange(exam, true);
    },
    [applyPublishChange]
  );

  const confirmUnpublish = useCallback(async () => {
    if (!unpublishTarget || unpublishCooldownSec > 0) return;
    const exam = unpublishTarget;
    closeUnpublishModal();
    await applyPublishChange(exam, false);
  }, [unpublishTarget, unpublishCooldownSec, closeUnpublishModal, applyPublishChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    if (files.length) {
      const file = files[0];
      setSelectedFile(file);
      setUploadError(null);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) {
      const file = files[0];
      setSelectedFile(file);
      setUploadError(null);
    }
    e.target.value = "";
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadError(null);
  }, []);

  const dismissAnalyzeProgress = useCallback(() => {
    setShowAnalyzeProgress(false);
    setAnalyzePhases([]);
    setPhaseTimings({});
    setActivePhaseId(null);
    setOverallStartedAt(null);
    setAnalyzeError(null);
    setTotalPredictedLabel(undefined);
  }, []);

  const applyProgressEvent = useCallback((event: ProgressEvent) => {
    switch (event.type) {
      case "init":
        setAnalyzePhases((prev) => {
          const upload = prev.find((p) => p.id === PHASE_UPLOAD);
          return upload ? [upload, ...event.phases] : event.phases;
        });
        if (event.totalPredictedLabel) setTotalPredictedLabel(event.totalPredictedLabel);
        break;
      case "phase_start":
        setActivePhaseId(event.phaseId);
        setPhaseTimings((prev) => ({
          ...prev,
          [event.phaseId]: {
            ...prev[event.phaseId],
            status: "active",
            startedAt: event.at,
          },
        }));
        break;
      case "phase_done":
        setPhaseTimings((prev) => ({
          ...prev,
          [event.phaseId]: {
            status: "done",
            durationMs: event.durationMs,
            detail: event.detail,
            startedAt: prev[event.phaseId]?.startedAt,
          },
        }));
        break;
      case "phase_error":
        setActivePhaseId(event.phaseId);
        setPhaseTimings((prev) => ({
          ...prev,
          [event.phaseId]: {
            ...prev[event.phaseId],
            status: "error",
            errorMessage: event.message,
          },
        }));
        break;
      case "error":
        setAnalyzeError({
          failedPhaseId: event.failedPhaseId,
          title: event.title,
          message: event.message,
          reason: event.reason,
          suggestion: event.suggestion,
          errorCode: event.errorCode,
          moduleSummary: event.moduleSummary,
          modeMismatchWarning: event.modeMismatchWarning,
        });
        if (event.failedPhaseId) {
          setActivePhaseId(event.failedPhaseId);
          setPhaseTimings((prev) => ({
            ...prev,
            [event.failedPhaseId!]: {
              ...prev[event.failedPhaseId!],
              status: "error",
              errorMessage: event.message,
            },
          }));
        }
        break;
      default:
        break;
    }
  }, []);

  async function handleApAnalyze() {
    if (!selectedFile || !canAnalyze || !subject) return;

    const started = Date.now();
    const { phases, totalPredictedLabel: predictedLabel } = buildClientAnalyzePhases({
      subject,
      satAdaptiveMode: "none",
    });

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessDetail(null);
    setUploadModeWarning(null);
    setAnalyzeError(null);
    setAnalyzePhases(phases);
    setPhaseTimings({
      [PHASE_UPLOAD]: { status: "active", startedAt: started },
    });
    setActivePhaseId(PHASE_UPLOAD);
    setOverallStartedAt(started);
    setTotalPredictedLabel(predictedLabel);
    setShowAnalyzeProgress(true);

    requestAnimationFrame(() => {
      progressPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const extractStarted = Date.now();
    setPhaseTimings((prev) => ({
      ...prev,
      [PHASE_UPLOAD]: {
        status: "done",
        durationMs: extractStarted - started,
        startedAt: started,
      },
      [PHASE_EXTRACT]: { status: "active", startedAt: extractStarted },
    }));
    setActivePhaseId(PHASE_EXTRACT);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email ?? "";

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("subject", subject);
      formData.append("questionCount", String(questionCountNum));
      formData.append("userEmail", sessionEmail);
      formData.append(
        "hasVisuals",
        isCode ? "true" : (hasVisualsInPdf ? "true" : "false")
      );
      formData.append("aiProvider", "gemini");

      const res = await fetch("/api/upload/analyze", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as {
        examId?: string;
        questionCount?: number;
        error?: string;
      };

      if (!res.ok) {
        const err = formatFriendlyAnalyzeError(data.error ?? "Analysis failed. Try again.", {
          failedPhaseId: PHASE_EXTRACT,
        });
        setAnalyzeError(err);
        setPhaseTimings((prev) => ({
          ...prev,
          [PHASE_EXTRACT]: {
            status: "error",
            errorMessage: err.message,
            durationMs: Date.now() - extractStarted,
            startedAt: extractStarted,
          },
        }));
        setActivePhaseId(PHASE_EXTRACT);
        setUploadError(err.message);
        return;
      }

      const extractDone = Date.now();
      const saveStarted = extractDone;
      setPhaseTimings((prev) => ({
        ...prev,
        [PHASE_EXTRACT]: {
          status: "done",
          durationMs: extractDone - extractStarted,
          startedAt: extractStarted,
        },
        [PHASE_SAVE]: { status: "active", startedAt: saveStarted },
      }));
      setActivePhaseId(PHASE_SAVE);

      const saveDone = Date.now();
      setPhaseTimings((prev) => ({
        ...prev,
        [PHASE_SAVE]: {
          status: "done",
          durationMs: saveDone - saveStarted,
          startedAt: saveStarted,
        },
      }));
      setActivePhaseId(null);

      setUploads((prev) => [
        {
          id: data.examId ?? generateId(),
          name: selectedFile.name,
          subject,
          examProgram: "AP",
          questionCount: data.questionCount ?? questionCountNum,
          uploadedAt: new Date().toISOString(),
          isPublished: true,
        },
        ...prev,
      ]);
      setSelectedFile(null);
      setQuestionCount("");
      setTimeout(() => dismissAnalyzeProgress(), 2500);
    } catch {
      const err = formatFriendlyAnalyzeError("Connection error. Try again.", {
        failedPhaseId: PHASE_EXTRACT,
      });
      setAnalyzeError(err);
      setPhaseTimings((prev) => ({
        ...prev,
        [PHASE_EXTRACT]: {
          status: "error",
          errorMessage: err.message,
          durationMs: Date.now() - extractStarted,
          startedAt: extractStarted,
        },
      }));
      setActivePhaseId(PHASE_EXTRACT);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSatAnalyze() {
    if (!selectedFile || !canAnalyze || !subject) return;

    const started = Date.now();
    const uploadSatFormat: SatFormat = isSatFull
      ? "full_test"
      : isSatSection && satSectionFormat === "section_test"
        ? "section_test"
        : "single_module";
    const { phases, totalPredictedLabel: predictedLabel } = buildClientAnalyzePhases({
      subject,
      satAdaptiveMode: usesSatModuleUpload ? satAdaptiveMode : "none",
      satFormat: uploadSatFormat,
    });

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessDetail(null);
    setUploadModeWarning(null);
    setUploadModuleCountWarning(null);
    setUploadStructureSummary(null);
    setAnalyzeError(null);
    setAnalyzePhases(phases);
    setPhaseTimings({
      [PHASE_UPLOAD]: { status: "active", startedAt: started },
    });
    setActivePhaseId(PHASE_UPLOAD);
    setOverallStartedAt(started);
    setTotalPredictedLabel(predictedLabel);
    setShowAnalyzeProgress(true);

    requestAnimationFrame(() => {
      progressPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    const uploadStarted = Date.now();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email ?? "";

      const signedRes = await fetch("/api/upload/create-signed-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userEmail,
          filename: selectedFile.name,
          contentType: "application/pdf",
          size: selectedFile.size,
        }),
      });
      const signedData = (await signedRes.json().catch(() => ({}))) as {
        bucket?: string;
        storagePath?: string;
        signedUrl?: string;
        token?: string;
        error?: string;
      };
      if (!signedRes.ok || !signedData?.signedUrl || !signedData?.token || !signedData?.storagePath || !signedData?.bucket) {
        const err = formatFriendlyAnalyzeError(
          signedData?.error ?? "Could not initialize upload. Try again.",
          { failedPhaseId: PHASE_UPLOAD }
        );
        setAnalyzeError(err);
        setPhaseTimings((prev) => ({
          ...prev,
          [PHASE_UPLOAD]: {
            status: "error",
            durationMs: Date.now() - uploadStarted,
            errorMessage: err.message,
            startedAt: uploadStarted,
          },
        }));
        setUploadError(err.message);
        return;
      }

      const { error: uploadStorageError } = await supabase.storage
        .from(signedData.bucket)
        .uploadToSignedUrl(signedData.storagePath, signedData.token, selectedFile, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadStorageError) {
        const err = formatFriendlyAnalyzeError(uploadStorageError.message || "Upload failed.", {
          failedPhaseId: PHASE_UPLOAD,
        });
        setAnalyzeError(err);
        setPhaseTimings((prev) => ({
          ...prev,
          [PHASE_UPLOAD]: {
            status: "error",
            durationMs: Date.now() - uploadStarted,
            errorMessage: err.message,
            startedAt: uploadStarted,
          },
        }));
        setUploadError(err.message);
        return;
      }

      setPhaseTimings((prev) => ({
        ...prev,
        [PHASE_UPLOAD]: {
          status: "done",
          durationMs: Date.now() - uploadStarted,
          startedAt: uploadStarted,
        },
      }));
      setActivePhaseId(null);

      const analyzeBody: Record<string, unknown> = {
        storagePath: signedData.storagePath,
        filename: selectedFile.name,
        subject,
        questionCount: effectiveQuestionCount,
        userEmail,
        hasVisuals: hasVisualsInPdf,
        aiProvider: "gemini",
        streamProgress: true,
        examProgram: "SAT",
        satFormat: uploadSatFormat,
        satAdaptiveMode: usesSatModuleUpload ? satAdaptiveMode : "none",
      };
      if (parsedSatModuleCounts) {
        analyzeBody.satModuleQuestionCounts = parsedSatModuleCounts;
      }
      if (usesSatModuleUpload) {
        if (satCutoffRw.trim() && (isSatFull || isSatRw(subject))) {
          analyzeBody.satCutoffRw = parseInt(satCutoffRw.trim(), 10);
        }
        if (satCutoffMath.trim() && (isSatFull || isSatMath(subject))) {
          analyzeBody.satCutoffMath = parseInt(satCutoffMath.trim(), 10);
        }
      }

      const res = await fetch("/api/upload/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(analyzeBody),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const err = formatFriendlyAnalyzeError(data.error ?? "Analysis failed. Try again.", {});
        setAnalyzeError(err);
        setUploadError(err.message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completeData: Extract<ProgressEvent, { type: "complete" }> | null = null;
      let streamHadError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as ProgressEvent;
            applyProgressEvent(event);
            if (event.type === "complete") completeData = event;
            if (event.type === "error") streamHadError = true;
          } catch {
            // ignore malformed line
          }
        }
      }

      if (!completeData) {
        if (!streamHadError) {
          const err = formatFriendlyAnalyzeError("Analysis did not complete.", {});
          setAnalyzeError(err);
          setUploadError(err.message);
        }
        return;
      }

      if (completeData.moduleSummary) {
        setUploadSuccessDetail(completeData.moduleSummary);
      } else {
        setUploadSuccessDetail(null);
      }
      if (completeData.modeMismatchWarning) {
        setUploadModeWarning(completeData.modeMismatchWarning);
      } else {
        setUploadModeWarning(null);
      }
      if (completeData.moduleCountWarning) {
        setUploadModuleCountWarning(completeData.moduleCountWarning);
      } else {
        setUploadModuleCountWarning(null);
      }
      if (completeData.detectedStructureSummary) {
        setUploadStructureSummary(completeData.detectedStructureSummary);
      } else {
        setUploadStructureSummary(null);
      }

      setUploads((prev) => [
        {
          id: completeData.examId ?? generateId(),
          name: selectedFile.name,
          subject,
          examProgram: "SAT",
          questionCount: completeData.questionCount ?? effectiveQuestionCount,
          uploadedAt: new Date().toISOString(),
          isPublished: true,
        },
        ...prev,
      ]);
      setSelectedFile(null);
      setQuestionCount("");
      setSatAdaptiveMode("none");
      setSatCutoffRw("");
      setSatCutoffMath("");
      setActivePhaseId(null);
      setTimeout(() => dismissAnalyzeProgress(), 2500);
    } catch {
      const err = formatFriendlyAnalyzeError("Connection error. Try again.", {});
      setAnalyzeError(err);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAnalyze() {
    if (isProgramSat) {
      await handleSatAnalyze();
    } else {
      await handleApAnalyze();
    }
  }

  const subjectLabel = subject
    ? (SUBJECTS.find((s) => s.value === subject)?.label ?? subject)
    : isProgramSat
      ? "Select a test type"
      : "Select subject";

  const programUploads = uploads.filter((u) => u.examProgram === program);
  const filteredUploads = subjectFilter
    ? programUploads.filter((u) => u.subject === subjectFilter)
    : programUploads;

  const filteredInProgress = inProgressAttempts.filter(
    (a) => (a.examProgram ?? "AP") === program
  );
  const filteredRecent = recentAttempts.filter(
    (a) => (a.examProgram ?? "AP") === program
  );

  const wrongAnswersFromAttempt = expandedAttemptData
    ? expandedAttemptData.result.breakdown.filter(
        (b) =>
          b.correctAnswer != null &&
          String(b.correctAnswer).trim() !== "" &&
          !b.isCorrect &&
          b.userAnswer != null &&
          String(b.userAnswer).trim() !== ""
      )
    : [];

  const expandedAttemptIsSat =
    expandedAttemptData != null &&
    getExamProgram(expandedAttemptData.upload.subject) === "SAT";

  const wrongSatGroups = useMemo(() => {
    if (!expandedAttemptData || !expandedAttemptIsSat) return [];
    return getSatModuleGroups(expandedAttemptData.questions, expandedAttemptData.upload.subject, {
      satFormat: expandedAttemptData.upload.sat_format,
      satAdaptiveMode: expandedAttemptData.upload.sat_adaptive_mode,
    });
  }, [expandedAttemptData, expandedAttemptIsSat]);

  const expandedAttemptRecent = useMemo(() => {
    if (!expandedAttemptId) return null;
    return recentAttempts.find((r) => r.id === expandedAttemptId) ?? null;
  }, [expandedAttemptId, recentAttempts]);

  const subjectFilterLabel =
    subjectFilter === ""
      ? "All subjects"
      : SUBJECTS_FILTER.find((s) => s.value === subjectFilter)?.label ?? subjectFilter;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Upload exam PDF
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isProgramSat
              ? "Upload your Digital SAT exam PDF to get started. The AI will extract questions automatically."
              : "Upload your AP exam PDF to get started. The AI will extract questions automatically."}
          </p>
        </div>

        {filteredInProgress.length > 0 && (
          <section className="mb-8">
            <div className="rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={continuingExamsOpen}
                onClick={() => setContinuingExamsOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Enter" && setContinuingExamsOpen((o) => !o)}
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-amber-50/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      Continuing exams
                      <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums">
                        {filteredInProgress.length}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Resume where you left off, or discard an attempt to remove it from this list.
                    </p>
                  </div>
                </div>
                {continuingExamsOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                )}
              </div>
              {continuingExamsOpen && (
                <div className="border-t border-amber-100 divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                  {filteredInProgress.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 hover:bg-amber-50/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 line-clamp-1"
                          title={a.filename}
                        >
                          {a.filename}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {SUBJECT_LABELS[a.subject as SubjectKey] ?? a.subject}
                          <span className="text-gray-400">
                            {" · "}Started{" "}
                            {new Date(a.startedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/exam/${a.uploadId}?resume=${a.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Continue
                        </Link>
                        <button
                          type="button"
                          disabled={deletingInProgressId === a.id}
                          onClick={() => void handleDiscardInProgress(a.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label="Discard in-progress exam"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Discard
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {filteredRecent.length > 0 && (
          <section className="mb-8">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={recentExamsOpen}
                onClick={() => setRecentExamsOpen((o) => !o)}
                onKeyDown={(e) => e.key === "Enter" && setRecentExamsOpen((o) => !o)}
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      Recent exams
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 tabular-nums">
                        {filteredRecent.length}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Click an attempt to review its score and wrong answers.
                    </p>
                  </div>
                </div>
                {recentExamsOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                )}
              </div>
              {recentExamsOpen && (
              <div className="border-t border-gray-200 divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {filteredRecent.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "transition-colors",
                    expandedAttemptId === a.id && "border-l-2 border-l-blue-500 bg-blue-50/30"
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedAttemptId === a.id}
                    onClick={() => setExpandedAttemptId(expandedAttemptId === a.id ? null : a.id)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      setExpandedAttemptId(expandedAttemptId === a.id ? null : a.id)
                    }
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-gray-900 line-clamp-1"
                        title={a.filename}
                      >
                        {a.filename}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {SUBJECT_LABELS[a.subject as SubjectKey] ?? a.subject}
                        <span className="text-gray-400">
                          {" · "}
                          {new Date(a.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                      {a.skipAiGrading ? (
                        <p className="text-[10px] text-amber-700 font-medium">No AI grading</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 shrink-0 sm:justify-end sm:text-right">
                      {a.examProgram === "SAT" && a.totalScaledScore != null ? (
                        <>
                          <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                            {a.totalScaledScore}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 leading-none">
                            scaled
                          </span>
                          {(a.rwScaledScore != null || a.mathScaledScore != null) && (
                            <span className="text-[11px] text-gray-600 tabular-nums leading-snug">
                              R&amp;W {a.rwScaledScore ?? "—"} · Math {a.mathScaledScore ?? "—"}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                            {a.percentage != null ? `${a.percentage}%` : "—"}
                          </span>
                          <span className="text-[11px] text-gray-600 tabular-nums leading-snug">
                            {a.skipAiGrading
                              ? `${a.correctCount} correct · ${a.incorrectCount} incorrect · ${a.notGradedCount ?? 0} not graded · ${a.unansweredCount ?? 0} unanswered · ${a.totalQuestions} total`
                              : `${a.correctCount} correct · ${a.incorrectCount} incorrect · ${a.unansweredCount ?? 0} unanswered · ${a.totalQuestions} total`}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/exam/${a.uploadId}?attempt=${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Results
                      </Link>
                      <button
                        type="button"
                        disabled={deletingAttemptId === a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttempt(a.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Delete attempt"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-gray-400 transition-transform",
                          expandedAttemptId === a.id && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
            {expandedAttemptId === a.id && (
              <div className="border-t border-gray-200 bg-gray-50/50 p-4">
                      {expandedAttemptLoading ? (
                        <p className="text-sm text-gray-500">Loading…</p>
                      ) : expandedAttemptData ? (
                        <>
                          {expandedAttemptIsSat && expandedAttemptRecent ? (
                            <SatAttemptSummary
                              attempt={expandedAttemptRecent}
                              groups={wrongSatGroups}
                              wrongAnswers={wrongAnswersFromAttempt}
                            />
                          ) : null}
                          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            Wrong answers ({wrongAnswersFromAttempt.length})
                          </h3>
                          {wrongAnswersFromAttempt.length === 0 ? (
                            <p className="text-sm text-gray-500">No wrong answers (unanswered excluded).</p>
                          ) : (
                            <>
                              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                                {expandedAttemptIsSat && wrongSatGroups.length > 0 ? (
                                  <div className="divide-y divide-gray-200">
                                    {wrongSatGroups.map((group) => {
                                      const wrongInGroup = group.questions
                                        .map((gq) => {
                                          const row = wrongAnswersFromAttempt.find(
                                            (b) => b.questionNumber === gq.question_number
                                          );
                                          return row ? { gq, row } : null;
                                        })
                                        .filter(
                                          (x): x is { gq: AttemptQuestion; row: AttemptBreakdownRow } =>
                                            x != null
                                        );
                                      if (wrongInGroup.length === 0) return null;
                                      return (
                                        <details key={group.id} className="group" open>
                                          <summary className="cursor-pointer bg-gray-50/80 px-4 py-3 font-medium text-gray-900 flex items-center justify-between list-none">
                                            <span>{group.label}</span>
                                            <span className="text-sm font-normal text-red-600">
                                              {wrongInGroup.length} incorrect
                                            </span>
                                          </summary>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead>
                                                <tr className="border-b border-gray-200 bg-gray-50">
                                                  <th className="text-left px-4 py-3 font-medium text-gray-700">#</th>
                                                  <th className="text-left px-4 py-3 font-medium text-gray-700">Your Answer</th>
                                                  <th className="text-left px-4 py-3 font-medium text-gray-700">Correct</th>
                                                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {wrongInGroup.map(({ gq, row }) => {
                                                  const displayNum = getModuleDisplayNumber(
                                                    group.questions,
                                                    gq
                                                  );
                                                  return (
                                                    <tr
                                                      key={row.questionNumber}
                                                      onClick={() => handleWrongRowClick(row.questionNumber)}
                                                      className={cn(
                                                        "border-b border-gray-100 cursor-pointer transition-colors",
                                                        selectedWrongQuestion === row.questionNumber
                                                          ? "bg-blue-50"
                                                          : "hover:bg-gray-50"
                                                      )}
                                                    >
                                                      <td className="px-4 py-3 font-medium text-gray-900">
                                                        {displayNum}
                                                      </td>
                                                      <td className="px-4 py-3 text-red-600">{row.userAnswer ?? "—"}</td>
                                                      <td className="px-4 py-3 text-green-600">{row.correctAnswer ?? "—"}</td>
                                                      <td className="px-4 py-3">
                                                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                                                          Incorrect
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </details>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                          <th className="text-left px-4 py-3 font-medium text-gray-700">#</th>
                                          <th className="text-left px-4 py-3 font-medium text-gray-700">Your Answer</th>
                                          <th className="text-left px-4 py-3 font-medium text-gray-700">Correct</th>
                                          <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {wrongAnswersFromAttempt.map((row) => (
                                          <tr
                                            key={row.questionNumber}
                                            onClick={() => handleWrongQuestionClick(row.questionNumber)}
                                            className={cn(
                                              "border-b border-gray-100 cursor-pointer transition-colors",
                                              selectedWrongQuestion === row.questionNumber ? "bg-blue-50" : "hover:bg-gray-50"
                                            )}
                                          >
                                            <td className="px-4 py-3 font-medium text-gray-900">{row.questionNumber}</td>
                                            <td className="px-4 py-3 text-red-600">{row.userAnswer ?? "—"}</td>
                                            <td className="px-4 py-3 text-green-600">{row.correctAnswer ?? "—"}</td>
                                            <td className="px-4 py-3">
                                              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                                                Incorrect
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                              {selectedWrongQuestion != null && (() => {
                                const selectedQ = expandedAttemptData.questions.find((q) => q.question_number === selectedWrongQuestion);
                                const formatWrongMath = (text: string | null | undefined) =>
                                  formatMathTextIfNeeded(
                                    text ?? "",
                                    shouldFormatMathNotation(
                                      expandedAttemptData.upload.subject,
                                      selectedQ?.sat_section === "rw" || selectedQ?.sat_section === "math"
                                        ? selectedQ.sat_section
                                        : null
                                    )
                                  );
                                const selectedDisplayNum =
                                  selectedQ && expandedAttemptIsSat
                                    ? getModuleDisplayNumber(expandedAttemptData.questions, selectedQ)
                                    : selectedQ?.question_number;
                                return (
                                  <div className="mt-6 rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setWrongResultViewMode("question")}
                                          className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                            wrongResultViewMode === "question"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          )}
                                        >
                                          Show question
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            expandedAttemptIsSat
                                              ? void loadWrongExplanation(selectedWrongQuestion)
                                              : setWrongResultViewMode("explanation")
                                          }
                                          className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                            wrongResultViewMode === "explanation"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          )}
                                        >
                                          Solution explanation
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedWrongQuestion(null);
                                          setWrongResultExplanation(null);
                                          setWrongResultViewMode("question");
                                        }}
                                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                                      >
                                        <X className="h-4 w-4" />
                                        Close
                                      </button>
                                    </div>
                                    {wrongResultViewMode === "explanation" ? (
                                      wrongResultExplanationLoading ? (
                                        <p className="text-sm text-gray-500">Loading explanation…</p>
                                      ) : wrongResultExplanation ? (
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{wrongResultExplanation}</div>
                                      ) : expandedAttemptIsSat ? (
                                        <p className="text-sm text-gray-500">
                                          Click &quot;Solution explanation&quot; to load an AI explanation for this question.
                                        </p>
                                      ) : null
                                    ) : selectedQ ? (
                                      <div className="space-y-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-200 text-gray-900 font-bold">
                                          {selectedDisplayNum ?? 0}
                                        </div>
                                        {selectedQ.passage_text?.trim() ? (
                                          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passage</p>
                                            <div className="text-sm text-gray-800 whitespace-pre-wrap">
                                              {formatWrongMath(selectedQ.passage_text)}
                                            </div>
                                          </div>
                                        ) : null}
                                        {selectedQ.precondition_text?.trim() ? (
                                          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Precondition</p>
                                            <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{selectedQ.precondition_text}</pre>
                                          </div>
                                        ) : null}
                                        <p className="text-gray-900 font-medium">
                                          {formatWrongMath(selectedQ.question_text) || "Which of the following is correct?"}
                                        </p>
                                        <div className="space-y-2">
                                          {[
                                            { key: "A", text: selectedQ.option_a },
                                            { key: "B", text: selectedQ.option_b },
                                            { key: "C", text: selectedQ.option_c },
                                            { key: "D", text: selectedQ.option_d },
                                            { key: "E", text: selectedQ.option_e },
                                          ]
                                            .filter((o): o is { key: string; text: string } => o.text != null && String(o.text).trim() !== "")
                                            .map(({ key, text }) => (
                                              <div
                                                key={key}
                                                className="flex items-start gap-3 rounded-lg border border-gray-300 px-4 py-3 bg-white text-left text-sm"
                                              >
                                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-400 font-medium">
                                                  {key}
                                                </span>
                                                <span className="flex-1 min-w-0 text-gray-800">{formatWrongMath(text)}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </>
                      ) : null}
              </div>
            )}
                </div>
              ))}
              </div>
              )}
            </div>
          </section>
        )}

        {!showUploadForm ? (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border-2 border-blue-600 bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:border-blue-700 hover:shadow-lg transition-all sm:w-auto sm:px-8 sm:py-5"
            >
              <Upload className="h-6 w-6" />
              Upload & Analyze with AI
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Click to open the file selection and analysis form.
            </p>
          </section>
        ) : (
          <div className="grid lg:grid-cols-[1fr,380px] gap-8">
            <div>
            {/* Step indicator */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold">1</span>
              <span className="text-sm text-gray-500">Select PDF</span>
              <span className="text-gray-300">→</span>
              <span className={cn("flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold", subject && selectedFile ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500")}>2</span>
              <span className="text-sm text-gray-500">Subject & count</span>
              <span className="text-gray-300">→</span>
              <span className={cn("flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold", canAnalyze ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500")}>3</span>
              <span className="text-sm text-gray-500">Analyze</span>
            </div>

            {/* File selection only – click to open file picker */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Select PDF file
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadError(null);
                    setSelectedFile(null);
                    setSubject("");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                  isDragging
                    ? "border-blue-600 bg-blue-600/5"
                    : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  disabled={isUploading}
                />
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Drag and drop a PDF or click to choose a file
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Click to open the file picker. This process may take a while.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>Only PDF format is accepted.</span>
                </div>
                <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong className="font-semibold">Size limit:</strong> Files larger than{" "}
                    {MAX_PDF_UPLOAD_MB} MB are not accepted. Maximum file size is{" "}
                    {MAX_PDF_UPLOAD_MB} MB.
                  </span>
                </div>
                {selectedFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-white border border-gray-200 px-4 py-2 max-w-md mx-auto">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-800 truncate flex-1">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      ({selectedFile.size >= 1024 * 1024
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
                        : `${(selectedFile.size / 1024).toFixed(1)} KB`})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {pdfTooLarge && (
                  <div
                    className="mt-3 mx-auto max-w-md rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 text-left"
                    role="alert"
                  >
                    This file is too large to upload. PDFs must be at most{" "}
                    {MAX_PDF_UPLOAD_MB} MB. Try compressing the file or removing extra pages.
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  If your PDF is too large to upload, you can use our merge app to split or
                  combine pages and reduce file size.
                </p>
                <a
                  href="https://pdfmerge-beta.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open PDF Merge App
                </a>
              </div>
            </section>

            {/* Subject and analysis section */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Subject and analysis
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isProgramSat ? "Test type" : "Subject"}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSubjectOpen((o) => !o)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                        "border-gray-200 bg-white text-gray-900",
                        "focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-gray-500" />
                        {subjectLabel}
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 text-gray-500", subjectOpen && "rotate-180")}
                      />
                    </button>
                    {subjectOpen && (
                      <div className="absolute z-10 mt-1 w-full max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                        <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          {isProgramSat ? "Test type" : "AP Subjects"}
                        </div>
                        {uploadSubjectOptions.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => {
                              setSubject(s.value);
                              const def = SUBJECT_DEFAULT_HAS_VISUALS[s.value];
                              setHasVisualsInPdf(def === "code" ? true : def);
                              setSubjectOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm",
                              subject === s.value
                                ? "bg-blue-600 text-white"
                                : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {!isProgramSat && (
                  <div className="w-full sm:w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Question count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {isSatSection && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    PDF structure
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setSatSectionFormat("single_module")}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-sm text-left",
                        satSectionFormat === "single_module"
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <span className="font-medium">Single practice sheet</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        All questions in one continuous exam
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSatSectionFormat("section_test")}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-sm text-left",
                        satSectionFormat === "section_test"
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <span className="font-medium">Multi-module (Digital SAT)</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Module 1 → Module 2 with Submit Module between
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {isProgramSat && satModuleFields.length > 0 && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Question count per module
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    How many questions does each module have in your PDF? Enter the same counts
                    (e.g. M1: 27, Module A: 27, Module B: 27).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {satModuleFields.map((field) => (
                      <div key={field.key} className="flex items-center gap-2">
                        <label
                          className="text-sm text-gray-700 shrink-0 min-w-[7rem]"
                          htmlFor={`sat-module-count-${field.key}`}
                        >
                          {field.shortLabel}
                        </label>
                        <input
                          id={`sat-module-count-${field.key}`}
                          type="number"
                          min={1}
                          max={99}
                          value={satModuleCounts[field.key] ?? ""}
                          onChange={(e) =>
                            setSatModuleCounts((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {usesSatModuleUpload && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <BookOpen className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {isSatFull
                          ? "SAT Full Test configuration"
                          : isSatRw(subject)
                            ? "SAT Reading & Writing configuration"
                            : "SAT Math configuration"}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {isSatFull
                          ? "Your PDF should contain all 4 modules (R&W M1, R&W M2, Math M1, Math M2). The AI will detect module boundaries automatically."
                          : isSatRw(subject)
                            ? "Your PDF should contain R&W Module 1 and Module 2 (or M1 + Easy/Hard paths for adaptive PDFs)."
                            : "Your PDF should contain Math Module 1 and Module 2 (or M1 + Easy/Hard paths for adaptive PDFs)."}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        PDF format
                      </label>
                      <select
                        value={satAdaptiveMode}
                        onChange={(e) => setSatAdaptiveMode(e.target.value as SatAdaptiveMode)}
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none bg-white"
                      >
                        <option value="none">
                          {isSatFull
                            ? "Non-adaptive (4 modules: M1 + M2 per section)"
                            : "Non-adaptive (2 modules: M1 + M2)"}
                        </option>
                        <option value="six_module">
                          {isSatFull
                            ? "Six-module adaptive (Module 1 + Module A/B or Easy/Hard per section)"
                            : "Six-module adaptive (M1 + Module A/B or Easy/Hard)"}
                        </option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Use Six-module when your PDF has Module 1 plus Module A and Module B (or Easy/Hard) for the adaptive second stage. MCQ answer letters A–D are not module names.
                      </p>
                    </div>
                    {satAdaptiveMode === "six_module" && (
                      <div
                        className={cn(
                          "grid gap-3",
                          isSatFull ? "grid-cols-2" : "grid-cols-1"
                        )}
                      >
                        {(isSatFull || isSatRw(subject)) && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              R&W M1 cutoff (optional)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={27}
                              value={satCutoffRw}
                              onChange={(e) => setSatCutoffRw(e.target.value)}
                              placeholder="e.g. 18"
                              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                            />
                          </div>
                        )}
                        {(isSatFull || isSatMath(subject)) && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Math M1 cutoff (optional)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={22}
                              value={satCutoffMath}
                              onChange={(e) => setSatCutoffMath(e.target.value)}
                              placeholder="e.g. 14"
                              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Cutoff = minimum correct answers in Module 1 to trigger the harder Module 2. Leave blank to fall back to ~60% of M1 questions.
                    </p>
                  </div>
                </div>
              )}
              {subject && !isCode && (
                <label
                  className={cn(
                    "mb-4 flex cursor-pointer items-center gap-4 rounded-lg border-2 px-4 py-3 transition-colors",
                    hasVisualsInPdf
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={hasVisualsInPdf ?? false}
                    onChange={(e) => setHasVisualsInPdf(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      hasVisualsInPdf ? "bg-blue-100" : "bg-gray-200"
                    )}>
                      <ImageIcon className={cn("h-5 w-5", hasVisualsInPdf ? "text-blue-600" : "text-gray-500")} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        My PDF contains images, tables, or graphs
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enable for better extraction of charts, diagrams, and data tables
                      </p>
                    </div>
                  </div>
                </label>
              )}
              {uploadError && (
                <p className="mb-3 text-sm text-red-600" role="alert">
                  {uploadError}
                </p>
              )}
              {uploadModeWarning && (
                <p className="mb-3 text-sm text-amber-700" role="status">
                  {uploadModeWarning}
                </p>
              )}
              {uploadModuleCountWarning && (
                <p className="mb-3 text-sm text-amber-700" role="status">
                  {uploadModuleCountWarning}
                </p>
              )}
              {uploadStructureSummary && (
                <p className="mb-3 text-sm text-gray-600" role="status">
                  PDF structure detected: {uploadStructureSummary}
                </p>
              )}
              {uploadSuccessDetail && (
                <p className="mb-3 text-sm text-green-700" role="status">
                  Modules extracted: {uploadSuccessDetail}
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isUploading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium",
                    canAnalyze && !isUploading
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <Brain className="h-4 w-4" />
                  {isUploading ? "Analyzing…" : "Analyze with AI"}
                </button>
                <p className="mt-1.5 text-xs text-gray-500">
                  {isProgramSat
                    ? "Select a PDF above and choose a test type to enable this button. This process may take a while."
                    : "Select a PDF above and enter subject and question count to enable this button. This process may take a while."}
                </p>
              </div>
              {showAnalyzeProgress && analyzePhases.length > 0 ? (
                <div ref={progressPanelRef}>
                  <UploadAnalyzeProgress
                    phases={analyzePhases}
                    phaseTimings={phaseTimings}
                    activePhaseId={activePhaseId}
                    overallStartedAt={overallStartedAt}
                    totalPredictedLabel={totalPredictedLabel}
                    error={analyzeError}
                    onDismiss={dismissAnalyzeProgress}
                    onTryAgain={analyzeError && !isUploading ? handleAnalyze : undefined}
                  />
                </div>
              ) : null}

              <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Lightbulb className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-amber-800 mb-1">Tips</p>
                  <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                    <li>Use clear scans for better question extraction.</li>
                    <li>Check &quot;My PDF contains images, tables, or graphs&quot; if your exam has visuals.</li>
                    <li>Only PDF format is accepted.</li>
                    <li>
                      PDF size must be at most {MAX_PDF_UPLOAD_MB} MB; larger files are rejected.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
            </div>

            {/* Right column: My exams */}
            <div className="lg:order-2">
              <section>
                {uploads.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm mb-6 ring-1 ring-gray-100/50">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="font-medium text-gray-900">
                        {filteredUploads.length} exam{filteredUploads.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">
                        {filteredUploads.reduce((s, e) => s + e.questionCount, 0)} total questions
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    My exams
                  </h2>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSubjectFilterOpen((o) => !o)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                        "hover:bg-gray-50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      )}
                    >
                      {subjectFilterLabel}
                      <ChevronDown className={cn("h-4 w-4 text-gray-500", subjectFilterOpen && "rotate-180")} />
                    </button>
                    {subjectFilterOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          aria-hidden
                          onClick={() => setSubjectFilterOpen(false)}
                        />
                        <div className="absolute right-0 z-20 mt-1 min-w-[260px] max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            key="all"
                            type="button"
                            onClick={() => {
                              setSubjectFilter("");
                              setSubjectFilterOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm",
                              subjectFilter === ""
                                ? "bg-blue-600 text-white"
                                : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            All subjects
                          </button>
                          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">
                            AP
                          </div>
                          {AP_SUBJECT_OPTIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => {
                                setSubjectFilter(s.value as SubjectValue | "");
                                setSubjectFilterOpen(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm",
                                subjectFilter === s.value
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-700 hover:bg-gray-50"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">
                            SAT
                          </div>
                          {SAT_SUBJECT_OPTIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => {
                                setSubjectFilter(s.value as SubjectValue | "");
                                setSubjectFilterOpen(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm",
                                subjectFilter === s.value
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-700 hover:bg-gray-50"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {deleteError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>{deleteError}</span>
              <button
                type="button"
                onClick={() => setDeleteError(null)}
                className="text-red-500 hover:text-red-700 font-medium"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}
          {filteredUploads.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              {uploads.length === 0 ? "No exams yet. Upload a PDF above." : "No exams match this filter."}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm overflow-x-auto -mx-3 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PDF name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Publish
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredUploads.map((exam) => (
                    <tr key={exam.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {exam.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide leading-none",
                              exam.examProgram === "SAT"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {exam.examProgram}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {SUBJECTS.find((s) => s.value === exam.subject)?.label ?? exam.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {exam.questionCount || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(exam.uploadedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={exam.isPublished}
                          disabled={togglingPublishId === exam.id}
                          onClick={() => void handlePublishToggleClick(exam)}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                            exam.isPublished
                              ? "bg-green-600 focus:ring-green-500"
                              : "bg-gray-200 focus:ring-blue-500"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                              exam.isPublished ? "translate-x-5" : "translate-x-1"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/exam/${exam.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start exam
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === exam.id}
                            onClick={async () => {
                              setDeleteError(null);
                              setDeletingId(exam.id);
                              try {
                                const supabase = createClient();
                                const {
                                  data: { session },
                                } = await supabase.auth.getSession();
                                const token = session?.access_token;
                                if (!token) {
                                  setDeleteError("Please sign in again.");
                                  return;
                                }
                                const res = await fetch(`/api/upload/${exam.id}`, {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  setDeleteError((data.error as string) || "Failed to delete exam.");
                                  return;
                                }
                                setUploads((prev) => prev.filter((u) => u.id !== exam.id));
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
              </section>
            </div>
          </div>
        )}
        {!showUploadForm && (
          <section className="mt-8">
            {uploads.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm mb-6 ring-1 ring-gray-100/50">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-medium text-gray-900">
                    {filteredUploads.length} exam{filteredUploads.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">
                    {filteredUploads.reduce((s, e) => s + e.questionCount, 0)} total questions
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                My exams
              </h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSubjectFilterOpen((o) => !o)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                    "hover:bg-gray-50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  )}
                >
                  {subjectFilterLabel}
                  <ChevronDown className={cn("h-4 w-4 text-gray-500", subjectFilterOpen && "rotate-180")} />
                </button>
                {subjectFilterOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setSubjectFilterOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-1 min-w-[260px] max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        key="all"
                        type="button"
                        onClick={() => {
                          setSubjectFilter("");
                          setSubjectFilterOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm",
                          subjectFilter === ""
                            ? "bg-blue-600 text-white"
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        All subjects
                      </button>
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">
                        AP
                      </div>
                      {AP_SUBJECT_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setSubjectFilter(s.value as SubjectValue | "");
                            setSubjectFilterOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm",
                            subjectFilter === s.value
                              ? "bg-blue-600 text-white"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">
                        SAT
                      </div>
                      {SAT_SUBJECT_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setSubjectFilter(s.value as SubjectValue | "");
                            setSubjectFilterOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm",
                            subjectFilter === s.value
                              ? "bg-blue-600 text-white"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {deleteError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
                <span>{deleteError}</span>
                <button type="button" onClick={() => setDeleteError(null)} className="text-red-500 hover:text-red-700 font-medium" aria-label="Dismiss">Dismiss</button>
              </div>
            )}
            {filteredUploads.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{uploads.length === 0 ? "No exams yet. Upload a PDF above." : "No exams match this filter."}</div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm overflow-x-auto -mx-3 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publish</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredUploads.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{exam.name}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                                exam.examProgram === "SAT"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-blue-100 text-blue-700"
                              )}
                            >
                              {exam.examProgram}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{SUBJECTS.find((s) => s.value === exam.subject)?.label ?? exam.subject}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.questionCount || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(exam.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={exam.isPublished}
                            disabled={togglingPublishId === exam.id}
                            onClick={() => void handlePublishToggleClick(exam)}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                              exam.isPublished
                                ? "bg-green-600 focus:ring-green-500"
                                : "bg-gray-200 focus:ring-blue-500"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                                exam.isPublished ? "translate-x-5" : "translate-x-1"
                              )}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/exam/${exam.id}`} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><Play className="h-3.5 w-3.5" />Start exam</Link>
                            <button type="button" disabled={deletingId === exam.id} onClick={async () => { setDeleteError(null); setDeletingId(exam.id); try { const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession(); const token = session?.access_token; if (!token) { setDeleteError("Please sign in again."); return; } const res = await fetch(`/api/upload/${exam.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); const data = await res.json().catch(() => ({})); if (!res.ok) { setDeleteError((data.error as string) || "Failed to delete exam."); return; } setUploads((prev) => prev.filter((u) => u.id !== exam.id)); } finally { setDeletingId(null); } }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
      {unpublishTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeUnpublishModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unpublish-dialog-title"
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="unpublish-dialog-title" className="text-lg font-semibold text-gray-900">
              Unpublish this exam?
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              Published exams help everyone practice. We recommend keeping yours published.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeUnpublishModal}
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unpublishCooldownSec > 0 || togglingPublishId === unpublishTarget.id}
                onClick={() => void confirmUnpublish()}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium text-white",
                  unpublishCooldownSec > 0 || togglingPublishId === unpublishTarget.id
                    ? "bg-amber-700/50 cursor-not-allowed"
                    : "bg-amber-700 hover:bg-amber-800"
                )}
              >
                {unpublishCooldownSec > 0
                  ? `Unpublish anyway (${unpublishCooldownSec})`
                  : "Unpublish anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
