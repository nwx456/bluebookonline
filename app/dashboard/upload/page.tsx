"use client";

import { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertTriangle,
  Brain,
  Lightbulb,
  ImageIcon,
  Clock,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useDashboardAuth } from "@/components/library/DashboardAuthProvider";
import {
  ExamTypeChooser,
  UploadKindHeader,
  parseUploadExamKind,
  type UploadExamKind,
} from "@/components/dashboard/ExamTypeChooser";
import { FrqUploadSection } from "@/components/dashboard/FrqUploadSection";
import { PdfDropzone } from "@/components/dashboard/PdfDropzone";
import { UploadStepIndicator } from "@/components/dashboard/UploadStepIndicator";
import { SourceAttribution } from "@/components/exams/SourceAttribution";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ConsentModal } from "@/components/ConsentModal";
import {
  EXAM_SOURCE_TYPE_LABELS,
  validateExamSource,
  type ExamSourceType,
} from "@/lib/exam-source";
import { cn, generateId } from "@/lib/utils";
import {
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";
import { countQuestionsByUploadIds } from "@/lib/countQuestionsByUpload";
import { createClient } from "@/lib/supabase/client";
import {
  SUBJECT_KEYS,
  SUBJECT_LABELS,
  SUBJECT_DEFAULT_HAS_VISUALS,
  isCodeSubject,
  type SubjectKey,
} from "@/lib/subjects";
import {
  getExamProgram,
  isSatFullTest,
  isSatMath,
  isSatRw,
  isSatSectionUpload,
  isSatSubject,
  satSectionForSubject,
  SAT_MODULES,
  type SatAdaptiveMode,
  type SatFormat,
  type SatModuleId,
} from "@/lib/exam-program";
import { estimateApScore } from "@/lib/ap-score-estimate";
import { ApScoreReportCard } from "@/app/exam/components/ApScoreReportCard";
import { SatScoreReportCard } from "@/app/exam/components/SatScoreReportCard";
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
import { appendProgramToHref, useProgram } from "@/lib/use-program";
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
import type { ModerationStatus } from "@/lib/moderator-auth";
import {
  canRequestPublish,
  canUnpublishExam,
  UNPUBLISH_CONFIRM_COOLDOWN_SEC,
} from "@/lib/exam-publish-utils";

const SUBJECTS = SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] }));
const SUBJECTS_FILTER = [
  { value: "" as const, label: "All subjects" },
  ...SUBJECTS,
];
const AP_SUBJECT_OPTIONS = SUBJECTS.filter((s) => getExamProgram(s.value) === "AP");

function formatSatModuleCounts(moduleCounts: Partial<Record<SatModuleId, number>>): string {
  return SAT_MODULES.map((mod) => `${mod.shortLabel}: ${moduleCounts[mod.id] ?? 0}`).join(" | ");
}
const SAT_SUBJECT_ORDER: SubjectKey[] = ["SAT_RW", "SAT_MATH", "SAT_FULL_TEST"];
const SAT_SUBJECT_OPTIONS = SAT_SUBJECT_ORDER.map((value) => ({
  value,
  label: SUBJECT_LABELS[value],
}));

type SubjectValue = SubjectKey;

interface UploadedExam {
  id: string;
  name: string;
  subject: SubjectValue;
  examProgram: "AP" | "SAT";
  questionCount: number;
  uploadedAt: string;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  sourceType: ExamSourceType | null;
  sourceName: string | null;
  sourceUrl: string | null;
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

  const visibleGroups = useMemo(() => {
    return groups.filter((group) => {
      if (!group.id.includes("-")) return true;
      const progressKey = group.id.split("-")[0];
      const progress = attempt.moduleProgress?.[progressKey];
      const wrongInGroup = group.questions.filter((gq) =>
        wrongByQuestion.has(gq.question_number)
      ).length;
      if (progress && progress.total > 0) {
        return (
          Math.abs(group.questions.length - progress.total) <= 2 || wrongInGroup > 0
        );
      }
      return wrongInGroup > 0;
    });
  }, [groups, attempt.moduleProgress, wrongByQuestion]);

  const subject = attempt.subject as SubjectKey;
  const isFull = isSatFullTest(subject);

  return (
    <div className="mb-4 space-y-3">
      <SatScoreReportCard
        variant="compact"
        subject={subject}
        filename={attempt.filename}
        completedAt={attempt.completedAt}
        sat={{
          isFullTest: isFull,
          rwScaled: attempt.rwScaledScore ?? null,
          mathScaled: attempt.mathScaledScore ?? null,
          totalScaled: attempt.totalScaledScore ?? null,
        }}
      />

      {visibleGroups.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Module breakdown
          </p>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {visibleGroups.map((group) => {
              const total = group.questions.length;
              const progressKey = group.id.split("-")[0];
              const progress = attempt.moduleProgress?.[progressKey];
              const wrongCount = group.questions.filter((gq) =>
                wrongByQuestion.has(gq.question_number)
              ).length;
              const correct = progress?.correct ?? Math.max(0, total - wrongCount);
              const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
              return (
                <details key={group.id} className="bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 hover:bg-gray-50">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-600 tabular-nums sm:whitespace-nowrap">
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

function ApAttemptSummary(props: { attempt: RecentAttempt }) {
  const { attempt } = props;
  const subject = attempt.subject as SubjectKey;

  return (
    <div className="mb-4">
      <ApScoreReportCard
        variant="compact"
        subject={subject}
        filename={attempt.filename}
        completedAt={attempt.completedAt}
        percentage={attempt.percentage}
        correctCount={attempt.correctCount}
        incorrectCount={attempt.incorrectCount}
        total={attempt.totalQuestions}
        skipAiGrading={attempt.skipAiGrading}
        notGradedCount={attempt.notGradedCount}
      />
    </div>
  );
}

export default function DashboardUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <DashboardUploadPageInner />
    </Suspense>
  );
}

function DashboardUploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { program } = useProgram();
  const isProgramSat = program === "SAT";
  const examKind = parseUploadExamKind(searchParams.get("kind"));
  const effectiveExamKind =
    examKind === "frq" && isProgramSat
      ? "mcq"
      : examKind ?? (isProgramSat ? "mcq" : null);

  const selectExamKind = useCallback(
    (kind: UploadExamKind) => {
      router.push(appendProgramToHref(`/dashboard/upload?kind=${kind}`, program));
    },
    [router, program]
  );

  const clearExamKind = useCallback(() => {
    router.push(appendProgramToHref("/dashboard/upload", program));
  }, [router, program]);

  useEffect(() => {
    if (examKind === "frq" && isProgramSat) {
      router.replace(appendProgramToHref("/dashboard/upload?kind=mcq", "SAT"));
    }
  }, [examKind, isProgramSat, router]);

  const { checkingAuth, accessToken, userEmail, userDisplayName } = useDashboardAuth();
  const [subject, setSubject] = useState<SubjectValue | "">("");
  const [hasVisualsInPdf, setHasVisualsInPdf] = useState<boolean | null>(null);
  const [questionCount, setQuestionCount] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  const [uploadModerationNotice, setUploadModerationNotice] = useState(false);
  const [uploadModeWarning, setUploadModeWarning] = useState<string | null>(null);
  const [uploadModuleCountWarning, setUploadModuleCountWarning] = useState<string | null>(null);
  const [uploadStructureSummary, setUploadStructureSummary] = useState<string | null>(null);
  const [satModuleCounts, setSatModuleCounts] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<UploadedExam[]>([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<SubjectValue | "">("");
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const [unpublishTarget, setUnpublishTarget] = useState<UploadedExam | null>(null);
  const [uploadConsentOpen, setUploadConsentOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [sourceType, setSourceType] = useState<ExamSourceType | "">("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceUrlCheck, setSourceUrlCheck] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [sourceUrlCheckError, setSourceUrlCheckError] = useState("");
  const [, setNotOfficialConfirmed] = useState(false);
  const [unpublishCooldownSec, setUnpublishCooldownSec] = useState(0);
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
  const sourceValidation = useMemo(() => {
    if (!sourceType) return { ok: false as const, error: "Select a source type." };
    return validateExamSource({
      sourceType,
      sourceName,
      sourceUrl: sourceType === "school" ? undefined : sourceUrl,
    });
  }, [sourceType, sourceName, sourceUrl]);
  const isSourceValid = sourceValidation.ok;

  const sourceUrlReadyToVerify = useMemo(() => {
    if (sourceType !== "book" && sourceType !== "agency") return false;
    const probe = validateExamSource({
      sourceType,
      sourceName: "x",
      sourceUrl,
    });
    return probe.ok;
  }, [sourceType, sourceUrl]);

  const isSourceUrlReachable =
    sourceType === "school" || sourceUrlCheck === "valid";

  const canAnalyze =
    selectedFile !== null &&
    !pdfTooLarge &&
    isQuestionCountValidEffective &&
    subject !== "" &&
    (isCode || hasVisualsInPdf !== null) &&
    isSourceValid &&
    isSourceUrlReachable;

  const subjectDetailsComplete =
    subject !== "" &&
    isQuestionCountValidEffective &&
    (isCode || hasVisualsInPdf !== null);

  const mcqActiveStep = useMemo((): 1 | 2 | 3 | 4 => {
    if (isUploading) return 4;
    if (!selectedFile) return 1;
    if (!subjectDetailsComplete) return 2;
    if (!isSourceValid) return 3;
    return 4;
  }, [selectedFile, subjectDetailsComplete, isSourceValid, isUploading]);

  const MCQ_UPLOAD_STEPS = [
    { id: 1, label: "Select PDF" },
    { id: 2, label: "Subject & count" },
    { id: 3, label: "Source" },
    { id: 4, label: "Analyze" },
  ] as const;

  useEffect(() => {
    if (sourceType === "school") {
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      return;
    }
    if (!sourceUrlReadyToVerify) {
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      return;
    }
    setSourceUrlCheck("idle");
    setSourceUrlCheckError("");
    const timer = window.setTimeout(() => {
      if (!accessToken) return;
      setSourceUrlCheck("checking");
      fetch("/api/upload/verify-source-url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceUrl }),
      })
        .then((res) => res.json())
        .then((data: { ok?: boolean; error?: string }) => {
          if (data.ok) {
            setSourceUrlCheck("valid");
            setSourceUrlCheckError("");
          } else {
            setSourceUrlCheck("invalid");
            setSourceUrlCheckError(
              data.error || "This source URL could not be verified."
            );
          }
        })
        .catch(() => {
          setSourceUrlCheck("invalid");
          setSourceUrlCheckError("Could not verify link. Try again.");
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [sourceType, sourceUrl, sourceUrlReadyToVerify, accessToken]);

  useEffect(() => {
    setSubjectFilter("");
    if (program === "SAT") {
      setSubject((prev) => {
        if (!prev || getExamProgram(prev as SubjectKey) !== "SAT") {
          return "SAT_RW";
        }
        return prev;
      });
      setHasVisualsInPdf((prev) =>
        prev === null ? Boolean(SUBJECT_DEFAULT_HAS_VISUALS.SAT_RW) : prev
      );
      setSatSectionFormat("single_module");
      setSatAdaptiveMode("none");
    }
  }, [program]);

  const satUploadExtractSummary = useMemo(() => {
    if (!isProgramSat || !subject) return null;
    const subjectLabel = SUBJECT_LABELS[subject as SubjectKey] ?? subject;
    const structureLabel =
      isSatFull || satSectionFormat === "section_test"
        ? "Multi-module (Digital SAT)"
        : "Single practice sheet";
    const adaptiveLabel =
      usesSatModuleUpload && satAdaptiveMode === "six_module"
        ? "Six-module adaptive"
        : usesSatModuleUpload
          ? "Non-adaptive"
          : null;
    const sectionsLabel = isSatFull
      ? "Reading & Writing + Math"
      : isSatRw(subject)
        ? "Reading & Writing only"
        : isSatMath(subject)
          ? "Math only"
          : "All sections";
    return { subjectLabel, structureLabel, adaptiveLabel, sectionsLabel };
  }, [
    isProgramSat,
    subject,
    isSatFull,
    satSectionFormat,
    usesSatModuleUpload,
    satAdaptiveMode,
  ]);

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
    if (!userEmail || checkingAuth) return;
    const supabase = createClient();
    supabase
      .from("pdf_uploads")
      .select("id, filename, subject, exam_program, created_at, is_published, moderation_status, source_type, source_name, source_url")
      .eq("user_email", userEmail)
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
            moderationStatus:
              (row.moderation_status as ModerationStatus) ??
              (row.is_published === true ? "approved" : "draft"),
            sourceType: (row.source_type as ExamSourceType | null) ?? null,
            sourceName: (row.source_name as string | null) ?? null,
            sourceUrl: (row.source_url as string | null) ?? null,
          }))
        );
      })
      .catch(() => {
        setUploads([]);
      });
  }, [userEmail, checkingAuth]);

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
      .catch(() => {
        setExpandedAttemptData(null);
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
      } catch {
        alert("Failed to discard.");
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
      const moderationStatus =
        (data.moderationStatus as ModerationStatus) ??
        (newPublished ? "pending_review" : "draft");
      const isPublished = data.isPublished === true;
      setUploads((prev) =>
        prev.map((u) =>
          u.id === exam.id ? { ...u, isPublished, moderationStatus } : u
        )
      );
    } catch {
      setDeleteError("Failed to update publish status.");
    } finally {
      setTogglingPublishId(null);
    }
  }, []);

  const handlePublishToggleClick = useCallback(
    async (exam: UploadedExam) => {
      if (canUnpublishExam(exam)) {
        setUnpublishTarget(exam);
        return;
      }
      if (canRequestPublish(exam.moderationStatus)) {
        await applyPublishChange(exam, true);
      }
    },
    [applyPublishChange]
  );

  const confirmUnpublish = useCallback(async () => {
    if (!unpublishTarget || unpublishCooldownSec > 0) return;
    const exam = unpublishTarget;
    closeUnpublishModal();
    await applyPublishChange(exam, false);
  }, [unpublishTarget, unpublishCooldownSec, closeUnpublishModal, applyPublishChange]);

  const handleSelectedFileChange = useCallback((file: File | null) => {
    setSelectedFile(file);
    setUploadError(null);
  }, []);

  const resetUploadForm = useCallback(() => {
    setShowUploadForm(false);
    setUploadError(null);
    setSelectedFile(null);
    setSubject("");
    setSourceType("");
    setSourceName("");
    setSourceUrl("");
    setSourceUrlCheck("idle");
    setSourceUrlCheckError("");
    setNotOfficialConfirmed(false);
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
    setUploadModerationNotice(false);
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
      if (sourceValidation.ok) {
        const s = sourceValidation.normalized;
        formData.append("sourceType", s.sourceType);
        formData.append("sourceName", s.sourceName);
        if (s.sourceUrl) formData.append("sourceUrl", s.sourceUrl);
      }

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
          isPublished: false,
          moderationStatus: "pending_review",
          sourceType: sourceValidation.ok ? sourceValidation.normalized.sourceType : null,
          sourceName: sourceValidation.ok ? sourceValidation.normalized.sourceName : null,
          sourceUrl: sourceValidation.ok ? sourceValidation.normalized.sourceUrl : null,
        },
        ...prev,
      ]);
      setSelectedFile(null);
      setQuestionCount("");
      setSourceType("");
      setSourceName("");
      setSourceUrl("");
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      setNotOfficialConfirmed(false);
      setUploadModerationNotice(true);
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
    setUploadModerationNotice(false);
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
      if (sourceValidation.ok) {
        const s = sourceValidation.normalized;
        analyzeBody.sourceType = s.sourceType;
        analyzeBody.sourceName = s.sourceName;
        if (s.sourceUrl) analyzeBody.sourceUrl = s.sourceUrl;
      }
      if (parsedSatModuleCounts) {
        const counts = { ...parsedSatModuleCounts };
        if (isSatRw(subject)) {
          for (const key of Object.keys(counts)) {
            if (key.startsWith("math")) delete counts[key];
          }
        } else if (isSatMath(subject)) {
          for (const key of Object.keys(counts)) {
            if (key.startsWith("rw")) delete counts[key];
          }
        }
        analyzeBody.satModuleQuestionCounts = counts;
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
          isPublished: false,
          moderationStatus: "pending_review",
          sourceType: sourceValidation.ok ? sourceValidation.normalized.sourceType : null,
          sourceName: sourceValidation.ok ? sourceValidation.normalized.sourceName : null,
          sourceUrl: sourceValidation.ok ? sourceValidation.normalized.sourceUrl : null,
        },
        ...prev,
      ]);
      setSelectedFile(null);
      setQuestionCount("");
      setSourceType("");
      setSourceName("");
      setSourceUrl("");
      setSourceUrlCheck("idle");
      setSourceUrlCheckError("");
      setNotOfficialConfirmed(false);
      setSatAdaptiveMode("none");
      setSatCutoffRw("");
      setSatCutoffMath("");
      setActivePhaseId(null);
      setUploadModerationNotice(true);
      setTimeout(() => dismissAnalyzeProgress(), 2500);
    } catch {
      const err = formatFriendlyAnalyzeError("Connection error. Try again.", {});
      setAnalyzeError(err);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function runAnalyze() {
    if (isProgramSat) {
      await handleSatAnalyze();
    } else {
      await handleApAnalyze();
    }
  }

  async function recordUploadConsents(token: string): Promise<boolean> {
    const sourceContext =
      sourceValidation.ok
        ? {
            source_type: sourceValidation.normalized.sourceType,
            source_name: sourceValidation.normalized.sourceName,
            ...(sourceValidation.normalized.sourceUrl
              ? {
                  source_url_domain: (() => {
                    try {
                      return new URL(sourceValidation.normalized.sourceUrl!).hostname;
                    } catch {
                      return null;
                    }
                  })(),
                }
              : {}),
          }
        : undefined;

    const res = await fetch("/api/user/record-consent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ consentType: "ai_processing", granted: true }),
    });
    if (!res.ok) return false;
    const res2 = await fetch("/api/user/record-consent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consentType: "copyright_attestation",
        granted: true,
        context: sourceContext,
      }),
    });
    if (!res2.ok) return false;
    const res3 = await fetch("/api/user/record-consent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ consentType: "public_publish", granted: true }),
    });
    return res3.ok;
  }

  async function handleAnalyze() {
    if (!selectedFile || !canAnalyze || !subject) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setUploadConsentOpen(true);
  }

  async function confirmUploadConsent() {
    setConsentLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const ok = await recordUploadConsents(token);
      if (!ok) {
        setUploadError("Could not save consent. Please try again.");
        return;
      }
      setUploadConsentOpen(false);
      await runAnalyze();
    } catch {
      setUploadError("Could not save consent. Please try again.");
    } finally {
      setConsentLoading(false);
    }
  }

  async function handleAnalyzeRetry() {
    await runAnalyze();
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!effectiveExamKind) {
    return <ExamTypeChooser onSelect={selectExamKind} />;
  }

  if (effectiveExamKind === "frq") {
    return (
      <>
        <UploadKindHeader kind="frq" onChangeType={clearExamKind} />
        <FrqUploadSection />
      </>
    );
  }


  return (
    <>
        <div className="mb-6">
          <UploadKindHeader
            kind="mcq"
            onChangeType={clearExamKind}
            showChangeType={!isProgramSat}
          />
          <h1 className="text-2xl font-bold text-gray-900">
            Upload exam PDF
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isProgramSat
              ? "Upload your Digital SAT exam PDF. The AI will extract questions automatically."
              : "Upload your AP exam PDF. The AI will extract questions automatically."}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Manage uploaded exams in{" "}
            <Link href="/dashboard/library" className="text-blue-600 hover:underline">
              Library
            </Link>
            .
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <h2 className="text-lg font-semibold text-gray-900">Upload exam</h2>
              <button
                type="button"
                onClick={resetUploadForm}
                className="text-sm text-gray-500 hover:text-gray-700 sm:hidden"
              >
                Close
              </button>
            </div>
            <div className="flex items-center gap-4">
              <UploadStepIndicator steps={MCQ_UPLOAD_STEPS} activeStep={mcqActiveStep} />
              <button
                type="button"
                onClick={resetUploadForm}
                className="hidden shrink-0 text-sm text-gray-500 hover:text-gray-700 sm:inline"
              >
                Close
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <section aria-labelledby="mcq-pdf-step">
              <h3 id="mcq-pdf-step" className="sr-only">
                Step 1: Select PDF
              </h3>
              <PdfDropzone
                file={selectedFile}
                onFileChange={handleSelectedFileChange}
                disabled={isUploading}
                variant="hero"
                title="Exam PDF"
                description="Drag and drop a PDF or click to choose a file"
              />
              <p className="mt-2 text-xs text-gray-500">
                Click to open the file picker. This process may take a while.
              </p>
              {pdfTooLarge && (
                <div
                  className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  This file is too large to upload. PDFs must be at most{" "}
                  {MAX_PDF_UPLOAD_MB} MB. Try compressing the file or removing extra pages.
                </div>
              )}
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

            <section aria-labelledby="mcq-subject-step" className="border-t border-gray-100 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 id="mcq-subject-step" className="text-sm font-semibold text-gray-900">
                  Subject and analysis
                </h3>
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

              {satUploadExtractSummary && (
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <p className="text-xs font-medium text-blue-900">Upload will extract</p>
                  <p className="text-sm text-gray-800 mt-1">
                    <span className="font-medium">{satUploadExtractSummary.subjectLabel}</span>
                    {" · "}
                    {satUploadExtractSummary.structureLabel}
                    {satUploadExtractSummary.adaptiveLabel
                      ? ` · ${satUploadExtractSummary.adaptiveLabel}`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Sections: {satUploadExtractSummary.sectionsLabel}
                  </p>
                  {isSatFull && (
                    <p className="text-xs text-amber-700 mt-1.5">
                      Only use Full Test when your PDF contains both R&amp;W and Math. For R&amp;W-only
                      PDFs, choose SAT Reading &amp; Writing instead.
                    </p>
                  )}
                </div>
              )}

              {isProgramSat && satModuleFields.length > 0 && (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    {usesSatModuleUpload ? "Question count per module" : "Total question count"}
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    {usesSatModuleUpload
                      ? "How many questions does each module have in your PDF? Enter the same counts (e.g. M1: 27, Module A: 27, Module B: 27)."
                      : "How many multiple-choice questions are in your PDF? All questions will be treated as one continuous practice sheet."}
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
                      {satAdaptiveMode === "six_module" && (
                        <p className="mt-2 text-xs text-amber-700 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                          If your PDF does not have Module A/B (Easy/Hard) headings, switch to
                          Non-adaptive or use Single practice sheet above.
                        </p>
                      )}
                    </div>
                    {satAdaptiveMode === "six_module" && (
                      <div
                        className={cn(
                          "grid gap-3",
                          isSatFull ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
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
            </section>

            <section aria-labelledby="mcq-source-step" className="border-t border-gray-100 pt-6">
              <h3 id="mcq-source-step" className="text-sm font-semibold text-gray-900">
                Exam source
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Tell us where this PDF comes from. This information is shown to other users after moderator approval.
              </p>
              <div className="mt-3 space-y-2">
                  {(Object.keys(EXAM_SOURCE_TYPE_LABELS) as ExamSourceType[]).map((type) => (
                    <label
                      key={type}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                        sourceType === type
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="sourceType"
                        value={type}
                        checked={sourceType === type}
                        onChange={() => {
                          setSourceType(type);
                          if (type === "school") {
                            setSourceUrl("");
                            setSourceName("");
                          }
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-gray-800">{EXAM_SOURCE_TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                </div>
                {sourceType && sourceType !== "school" ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label htmlFor="sourceName" className="block text-xs font-medium text-gray-700">
                        {sourceType === "book" ? "Book title" : "Agency name"}
                        <span className="text-red-600"> *</span>
                      </label>
                      <input
                        id="sourceName"
                        type="text"
                        value={sourceName}
                        onChange={(e) => setSourceName(e.target.value)}
                        maxLength={200}
                        placeholder={
                          sourceType === "book"
                            ? "e.g. Barron's AP Calculus"
                            : "e.g. Princeton Review"
                        }
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="sourceUrl" className="block text-xs font-medium text-gray-700">
                        Source URL <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="sourceUrl"
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => {
                          setSourceUrl(e.target.value);
                          setSourceUrlCheck("idle");
                          setSourceUrlCheckError("");
                        }}
                        placeholder="https://publisher or agency website"
                        className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      />
                      {sourceUrlCheck === "checking" ? (
                        <p className="mt-1.5 text-xs text-gray-500" role="status">
                          Checking link…
                        </p>
                      ) : sourceUrlCheck === "valid" ? (
                        <p className="mt-1.5 text-xs text-green-700" role="status">
                          Link verified
                        </p>
                      ) : sourceUrlCheck === "invalid" && sourceUrlCheckError ? (
                        <p className="mt-1.5 text-xs text-red-600" role="status">
                          {sourceUrlCheckError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {!isSourceValid && sourceType && !sourceValidation.ok ? (
                  <p className="mt-2 text-xs text-amber-700" role="status">
                    {sourceValidation.error}
                  </p>
                ) : null}
              <p className="mt-2 text-xs text-gray-500">
                False source claims may lead to moderator rejection or account restrictions.
              </p>
            </section>

            {uploadError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {uploadError}
              </div>
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
              {uploadModerationNotice && (
                <p className="mb-3 text-sm text-amber-800" role="status">
                  Publish pending — track status in{" "}
                  <Link href="/dashboard/library" className="text-blue-600 hover:underline">
                    Library
                  </Link>
                  .
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isUploading || sourceUrlCheck === "checking"}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium sm:w-auto",
                    canAnalyze && !isUploading && sourceUrlCheck !== "checking"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "cursor-not-allowed bg-gray-200 text-gray-500"
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
                    onTryAgain={analyzeError && !isUploading ? handleAnalyzeRetry : undefined}
                  />
                </div>
              ) : null}

              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm text-gray-700">
                  <p className="mb-1 font-medium text-amber-800">Tips</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-600">
                    <li>Use clear scans for better question extraction.</li>
                    <li>Check &quot;My PDF contains images, tables, or graphs&quot; if your exam has visuals.</li>
                    <li>Only PDF format is accepted.</li>
                    <li>
                      PDF size must be at most {MAX_PDF_UPLOAD_MB} MB; larger files are rejected.
                    </li>
                  </ul>
                </div>
              </div>
          </div>
        </div>
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
      <ConsentModal
        open={uploadConsentOpen}
        title="AI processing & upload consent"
        confirmLabel="I agree and analyze"
        onConfirm={() => void confirmUploadConsent()}
        onCancel={() => setUploadConsentOpen(false)}
        loading={consentLoading}
      >
        <p>
          Your PDF will be sent to third-party AI providers (Google Gemini and/or Anthropic Claude) to
          extract questions. Extracted content is stored on our servers. After moderator approval, this
          exam will be visible to all users on the public practice page.
        </p>
        <p className="mt-3">
          By continuing, you confirm you have the right to upload this content (see our{" "}
          <Link href="/copyright" className="text-blue-600 hover:underline">
            Copyright Policy
          </Link>
          ), that the source information above is accurate and not official College Board / ACT /
          Bluebook material (see{" "}
          <Link href="/terms#source-attestation-and-copyright-compliance" className="text-blue-600 hover:underline">
            upload rules
          </Link>
          ), agree to{" "}
          <Link href="/privacy#ai-processing-and-pdf-content" className="text-blue-600 hover:underline">
            AI data processing
          </Link>
          , and consent to public sharing once a moderator approves the exam.
        </p>
      </ConsentModal>
    </>
  );
}
