"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flag, Loader2, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  examContentSerifClass,
  examToolbarBtn,
  examToolbarBtnShowPage,
  examUi,
  formatDisplayUsername,
} from "@/app/exam/exam-ui-tokens";
import FullPageModal from "@/app/exam/[id]/FullPageModal";
import {
  GraphZoomHeaderToolbar,
  GraphZoomProvider,
} from "@/app/exam/[id]/GraphZoomContext";
import { FrqLeftPanelContent } from "@/components/frq/FrqLeftPanelContent";
import {
  hasFrqMeaningfulLeftContent,
  resolveFrqLeftPanelMode,
  showFrqZoomToolbar,
} from "@/lib/exam-left-panel-utils";
import { ExamHeader } from "@/app/exam/ExamHeader";
import { ExamFooter, ExamFooterQuestionNav } from "@/app/exam/ExamFooter";
import { ExamQuestionChrome } from "@/app/exam/ExamQuestionChrome";
import { BluebookCodeEditor } from "@/components/frq/BluebookCodeEditor";
import {
  JavaQuickReferenceButton,
  JavaQuickReferencePanel,
} from "@/components/frq/JavaQuickReference";
import { FrqReview, type FrqReviewResponse } from "@/components/frq/FrqReview";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ExamSourceLine } from "@/components/exams/ExamSourceLine";
import { QuestionReportButton } from "@/components/exam/QuestionReportButton";
import { MODERATOR_PREVIEW_ATTEMPT_ID } from "@/lib/moderator-exam-preview";
import { flattenFrqParts, formatFrqPartDisplayLabel, type FrqFlatPartItem } from "@/lib/frq-server";
import {
  frqStemProseClass,
  getFrqLeftPanelHtml,
  getFrqPartStemHtml,
  hasFrqPartStem,
} from "@/lib/frq-display";

const QuestionReportFlow = dynamic(
  () => import("@/components/exam/QuestionReportFlow"),
  { ssr: false }
);

const BluebookRichTextEditor = dynamic(
  () =>
    import("@/components/frq/BluebookRichTextEditor").then((m) => ({
      default: m.BluebookRichTextEditor,
    })),
  { ssr: false, loading: () => <div className="min-h-[120px] animate-pulse rounded bg-gray-100" /> }
);

interface FrqQuestion {
  id: string;
  questionNumber: number;
  questionType: string;
  promptHtml: string;
  stimulusHtml: string | null;
  parts: Array<{ label: string; prompt?: string; max_points?: number; display_label?: string }>;
  maxPoints: number;
  pageRefs?: number[] | null;
}

interface FrqUploadMeta {
  id: string;
  courseId: string;
  courseLabel: string;
  title: string;
  sectionDurationMin: number;
  sectionDirections: string;
  editorType: "code" | "richtext";
  maxScore: number;
  isPubliclyVisible?: boolean;
  sourceType?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  ownerEmail?: string | null;
}

type RubricBreakdown = Array<{
  criterion: string;
  max_points: number;
  earned_points: number;
  earned: boolean;
  justification: string;
}>;

const apStemTextClass = cn(
  "text-[19px] sm:text-[21px] font-medium leading-snug text-gray-900",
  examContentSerifClass
);

function responseKey(questionId: string, partLabel: string) {
  return `${questionId}::${partLabel}`;
}

function FrqMarkedForReviewWarning({
  items,
}: {
  items: FrqFlatPartItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Review before you submit</p>
      <p className="mt-1 text-sm text-amber-800">
        You marked {items.length} part{items.length === 1 ? "" : "s"} for review. Check them
        before continuing.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${item.questionId}::${item.partLabel}`}
            className="inline-block rounded border border-amber-200 bg-white px-2 py-1 text-sm font-medium text-amber-900"
          >
            {item.displayLabel}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FrqExamPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const frqUploadId = params.id as string;
  const reviewAttemptId = searchParams.get("reviewAttemptId");
  const assignmentId = searchParams.get("assignmentId");
  const moderatorPreview = searchParams.get("moderatorPreview") === "1";
  const moderatorPreviewQuestionId = searchParams.get("questionId")?.trim() ?? "";
  const moderatorPreviewPartLabel = searchParams.get("partLabel")?.trim() ?? "";
  const isModeratorPreview = moderatorPreview && !!moderatorPreviewQuestionId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<FrqUploadMeta | null>(null);
  const [questions, setQuestions] = useState<FrqQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(reviewAttemptId);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [questionListOpen, setQuestionListOpen] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const [timerPaused, setTimerPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [showEndExamConfirm, setShowEndExamConfirm] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState<{
    totalScore: number;
    maxScore: number;
    completedAt: string | null;
    responses: FrqReviewResponse[];
    sourceType?: string | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
  } | null>(null);
  const [javaRefOpen, setJavaRefOpen] = useState(false);
  const [leftPanelPercent, setLeftPanelPercent] = useState(50);
  const [mobilePanelTab, setMobilePanelTab] = useState<"passage" | "question">("passage");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const isDraggingRef = useRef(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flatItems: FrqFlatPartItem[] = useMemo(
    () =>
      flattenFrqParts(
        questions.map((q) => ({
          id: q.id,
          question_number: q.questionNumber,
          max_points: q.maxPoints,
          parts: q.parts,
        }))
      ),
    [questions]
  );

  const currentItem = flatItems[currentIndex] ?? null;
  const currentQuestion = useMemo(() => {
    if (!currentItem) return null;
    return questions.find((q) => q.id === currentItem.questionId) ?? null;
  }, [currentItem, questions]);

  const leftPanelHtml = useMemo(() => {
    if (!currentQuestion) return "";
    return getFrqLeftPanelHtml(currentQuestion);
  }, [currentQuestion]);

  const partStemHtml = useMemo(() => {
    if (!currentQuestion || !currentItem) return "";
    return getFrqPartStemHtml(
      currentQuestion,
      currentItem.partLabel,
      currentItem.partPrompt
    );
  }, [currentQuestion, currentItem]);

  const currentPdfPageNumber = useMemo(() => {
    if (!currentQuestion) return 1;
    const refs = currentQuestion.pageRefs;
    if (Array.isArray(refs) && refs.length > 0 && typeof refs[0] === "number") {
      return refs[0];
    }
    return currentQuestion.questionNumber;
  }, [currentQuestion]);

  const leftPanelMode = useMemo(() => {
    return resolveFrqLeftPanelMode(leftPanelHtml, {
      pdfUrl,
      pageNumber: currentPdfPageNumber,
      hasPageRefs: Boolean(currentQuestion?.pageRefs?.length),
    });
  }, [leftPanelHtml, pdfUrl, currentPdfPageNumber, currentQuestion?.pageRefs]);

  const hasMeaningfulLeftContent = hasFrqMeaningfulLeftContent(leftPanelMode);
  const showHeaderZoomToolbar = showFrqZoomToolbar(leftPanelMode);

  const isReview = Boolean(reviewAttemptId && reviewData);
  const isLastPart = currentIndex >= flatItems.length - 1;

  const showSourceAttribution = useMemo(() => {
    if (!upload?.sourceType || !upload?.sourceName) return false;
    const ownerEmail = upload.ownerEmail?.trim().toLowerCase();
    const viewerEmail = userEmail.trim().toLowerCase();
    const isOwner = Boolean(ownerEmail && viewerEmail && ownerEmail === viewerEmail);
    if (isOwner) return true;
    return upload.isPubliclyVisible === true;
  }, [upload, userEmail]);

  const flaggedItems = useMemo(
    () =>
      flatItems.filter((item) => flags[responseKey(item.questionId, item.partLabel)] === true),
    [flatItems, flags]
  );

  const emptyResponseCount = useMemo(
    () =>
      flatItems.filter((item) => {
        const text = responses[responseKey(item.questionId, item.partLabel)] ?? "";
        return !text.trim();
      }).length,
    [flatItems, responses]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          router.push("/login");
          return;
        }
        const email = session.user.email.toLowerCase();
        if (!cancelled) {
          setUserEmail(email);
          setUserName(
            (session.user.user_metadata?.username as string | undefined)?.trim() ||
              (session.user.user_metadata?.full_name as string | undefined)?.trim() ||
              ""
          );
        }
        const headers = { Authorization: `Bearer ${session.access_token}` };

        if (isModeratorPreview) {
          const previewParams = new URLSearchParams({
            examKind: "frq",
            questionId: moderatorPreviewQuestionId,
          });
          if (moderatorPreviewPartLabel) {
            previewParams.set("partLabel", moderatorPreviewPartLabel);
          }
          const previewRes = await fetch(
            `/api/moderator/exams/${frqUploadId}/preview?${previewParams.toString()}`,
            { headers }
          );
          const previewData = await previewRes.json().catch(() => ({}));
          if (!previewRes.ok || previewData.error) {
            throw new Error(
              typeof previewData.error === "string"
                ? previewData.error
                : "Could not load exam preview."
            );
          }
          if (!cancelled) {
            setUpload(previewData.upload as FrqUploadMeta);
            setQuestions(previewData.questions as FrqQuestion[]);
            setAttemptId(MODERATOR_PREVIEW_ATTEMPT_ID);
            const idx =
              typeof previewData.targetPartIndex === "number" && previewData.targetPartIndex >= 0
                ? previewData.targetPartIndex
                : 0;
            setCurrentIndex(idx);
            if (typeof previewData.pdfUrl === "string" && previewData.pdfUrl) {
              setPdfUrl(previewData.pdfUrl);
            }
            setTimerPaused(true);
            setRemainingSeconds((previewData.upload?.sectionDurationMin ?? 90) * 60);
          }
          return;
        }

        if (reviewAttemptId) {
          const res = await fetch(`/api/frq/exam/attempt/${reviewAttemptId}`, { headers });
          if (!res.ok) throw new Error("Could not load attempt.");
          const data = await res.json();
          setUpload({
            id: data.upload.id,
            courseId: data.upload.courseId,
            courseLabel: data.upload.courseLabel,
            title: data.upload.title,
            sectionDurationMin: 90,
            sectionDirections: "",
            editorType: data.upload.courseId === "AP_CSA" ? "code" : "richtext",
            maxScore: data.attempt.maxScore,
            isPubliclyVisible: data.upload.isPubliclyVisible === true,
            sourceType: data.upload.sourceType ?? null,
            sourceName: data.upload.sourceName ?? null,
            sourceUrl: data.upload.sourceUrl ?? null,
            ownerEmail: data.upload.ownerEmail ?? null,
          });
          setQuestions(data.questions);
          setAttemptId(reviewAttemptId);

          setReviewData({
            totalScore: data.attempt.totalScore ?? 0,
            maxScore: data.attempt.maxScore ?? 0,
            completedAt: data.attempt.completedAt,
            sourceType: data.upload.sourceType ?? null,
            sourceName: data.upload.sourceName ?? null,
            sourceUrl: data.upload.sourceUrl ?? null,
            responses: data.responses.map(
              (r: {
                questionNumber: number;
                partLabel: string;
                displayLabel?: string;
                partPrompt: string;
                score: number | null;
                maxPoints: number;
                rubricBreakdown: RubricBreakdown | null;
                aiFeedback: string | null;
                strengths: string[] | null;
                improvements: string[] | null;
                responseText: string;
              }): FrqReviewResponse => ({
                questionNumber: r.questionNumber,
                partLabel: r.partLabel,
                displayLabel:
                  r.displayLabel ?? formatFrqPartDisplayLabel(r.questionNumber, r.partLabel),
                partPrompt: r.partPrompt ?? "",
                score: r.score,
                maxPoints: r.maxPoints,
                feedback: r.aiFeedback,
                rubricBreakdown: r.rubricBreakdown,
                strengths: r.strengths,
                improvements: r.improvements,
                responseText: r.responseText,
              })
            ),
          });
          setLoading(false);
          return;
        }

        const [examRes, pdfRes] = await Promise.all([
          fetch(`/api/frq/upload/${frqUploadId}`, { headers }),
          fetch(`/api/frq/upload/${frqUploadId}/pdf-url`, { headers }),
        ]);
        if (!examRes.ok) throw new Error("Could not load FRQ exam.");
        const examData = await examRes.json();
        setUpload(examData.upload);
        setQuestions(examData.questions);
        setRemainingSeconds((examData.upload.sectionDurationMin ?? 90) * 60);

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          if (!cancelled && pdfData.pdfUrl) setPdfUrl(pdfData.pdfUrl as string);
        }

        const startRes = await fetch("/api/frq/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frqUploadId,
            userEmail: email,
            assignmentId: assignmentId ?? undefined,
          }),
        });
        if (!startRes.ok) {
          const err = await startRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Could not start exam.");
        }
        const { attemptId: newAttemptId } = await startRes.json();
        if (!cancelled) setAttemptId(newAttemptId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load exam.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [
    frqUploadId,
    reviewAttemptId,
    assignmentId,
    router,
    isModeratorPreview,
    moderatorPreviewQuestionId,
    moderatorPreviewPartLabel,
  ]);

  useEffect(() => {
    if (isReview || timerPaused || remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [isReview, timerPaused, remainingSeconds]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || attemptId === MODERATOR_PREVIEW_ATTEMPT_ID || submitting) return;
    setSubmitting(true);
    setGrading(true);
    setShowEndExamConfirm(false);
    try {
      const res = await fetch("/api/frq/exam/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Grading failed.");
      }
      router.push(`/frq/${frqUploadId}?reviewAttemptId=${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
      setGrading(false);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, submitting, frqUploadId, router]);

  useEffect(() => {
    if (
      remainingSeconds === 0 &&
      attemptId &&
      attemptId !== MODERATOR_PREVIEW_ATTEMPT_ID &&
      !isReview &&
      !grading &&
      !submitting &&
      !reviewAttemptId
    ) {
      void handleSubmit();
    }
  }, [remainingSeconds, attemptId, isReview, grading, submitting, reviewAttemptId, handleSubmit]);

  useEffect(() => {
    if (remainingSeconds <= 300 && remainingSeconds > 0) {
      setTimerVisible(true);
    }
  }, [remainingSeconds]);

  const saveResponse = useCallback(
    async (questionId: string, partLabel: string, text: string, flagged: boolean) => {
      if (!attemptId || attemptId === MODERATOR_PREVIEW_ATTEMPT_ID || isReview) return;
      const key = responseKey(questionId, partLabel);
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
      saveTimers.current[key] = setTimeout(async () => {
        await fetch("/api/frq/exam/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            questionId,
            partLabel,
            responseText: text,
            isFlagged: flagged,
          }),
        });
      }, 800);
    },
    [attemptId, isReview]
  );

  const handleResponseChange = (questionId: string, partLabel: string, text: string) => {
    const key = responseKey(questionId, partLabel);
    setResponses((prev) => ({ ...prev, [key]: text }));
    saveResponse(questionId, partLabel, text, flags[key] ?? false);
  };

  const toggleFlag = (questionId: string, partLabel: string) => {
    const key = responseKey(questionId, partLabel);
    const next = !(flags[key] ?? false);
    setFlags((prev) => ({ ...prev, [key]: next }));
    saveResponse(questionId, partLabel, responses[key] ?? "", next);
  };

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const percent = Math.max(20, Math.min(70, (e.clientX / window.innerWidth) * 100));
    setLeftPanelPercent(percent);
  }, []);

  const handleResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResize]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [handleResize, handleResizeEnd]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f2f5f9]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#f2f5f9] p-4">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/upload?kind=frq" className="text-blue-600 hover:underline">
          Back to FRQ uploads
        </Link>
      </div>
    );
  }

  if (isReview && reviewData && upload) {
    return (
      <FrqReview
        courseLabel={upload.courseLabel}
        title={upload.title}
        totalScore={reviewData.totalScore}
        maxScore={reviewData.maxScore}
        completedAt={reviewData.completedAt}
        responses={reviewData.responses}
        frqUploadId={upload.id}
        isPubliclyVisible={upload.isPubliclyVisible}
        sourceType={reviewData.sourceType ?? upload.sourceType}
        sourceName={reviewData.sourceName ?? upload.sourceName}
        sourceUrl={reviewData.sourceUrl ?? upload.sourceUrl}
      />
    );
  }

  if (!upload || !currentQuestion || !currentItem) return null;

  const timerUrgent = remainingSeconds <= 300 && remainingSeconds > 0;
  const activeKey = responseKey(currentItem.questionId, currentItem.partLabel);
  const activeResponse = responses[activeKey] ?? "";
  const displayUsername = formatDisplayUsername(userName, userEmail);
  const canReport =
    Boolean(
      attemptId &&
        attemptId !== MODERATOR_PREVIEW_ATTEMPT_ID &&
        process.env.NEXT_PUBLIC_QUESTION_REPORTS !== "0"
    );

  const answerPanel = (
    <div className="flex flex-col gap-4 p-6">
      <ExamQuestionChrome
        displayQuestionNumber={currentItem.displayLabel}
        markedForReview={flags[activeKey] ?? false}
        onToggleMarkForReview={() =>
          toggleFlag(currentItem.questionId, currentItem.partLabel)
        }
        showAbcDecor={false}
      />

      {hasFrqPartStem(partStemHtml) ? (
        <div
          className={cn(frqStemProseClass, apStemTextClass)}
          dangerouslySetInnerHTML={{ __html: partStemHtml }}
        />
      ) : currentItem.partDisplayLabel ? (
        <p className={apStemTextClass}>{currentItem.partDisplayLabel}</p>
      ) : currentItem.partLabel ? (
        <p className={apStemTextClass}>Part ({currentItem.partLabel})</p>
      ) : (
        <p className={apStemTextClass}>Your Response</p>
      )}

      {upload.editorType === "code" ? (
        <BluebookCodeEditor
          value={activeResponse}
          onChange={(text) =>
            handleResponseChange(currentItem.questionId, currentItem.partLabel, text)
          }
          label={
            currentItem.partDisplayLabel
              ? `${currentItem.partDisplayLabel.replace(/\.$/, "")}.java`
              : currentItem.partLabel
                ? `Part ${currentItem.partLabel}.java`
                : "Response.java"
          }
          disabled={grading || isModeratorPreview}
        />
      ) : (
        <BluebookRichTextEditor
          value={activeResponse}
          onChange={(html) =>
            handleResponseChange(currentItem.questionId, currentItem.partLabel, html)
          }
          disabled={grading || isModeratorPreview}
        />
      )}
    </div>
  );

  const headerToolbarExtras = (
    <>
      {pdfUrl ? (
        <button
          type="button"
          onClick={() => setFullPageModalOpen(true)}
          className={cn(examToolbarBtn, examToolbarBtnShowPage, "shrink-0")}
          aria-label="Show page"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          Show page
        </button>
      ) : null}
      {showHeaderZoomToolbar ? (
        <GraphZoomHeaderToolbar visible={showHeaderZoomToolbar} />
      ) : null}
      {canReport ? (
        <QuestionReportButton onClick={() => setReportModalOpen(true)} />
      ) : null}
    </>
  );

  return (
    <GraphZoomProvider>
    <div className={cn(examUi.examShellMobile, "bg-[#f2f5f9]")}>
      {isModeratorPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Moderator preview — read-only. Responses and reports are disabled.
        </div>
      ) : null}
      <ExamHeader
        headerTitle={`${upload.courseLabel} — Section II`}
        headerTitleShort={`${upload.courseLabel} — Sec II`}
        directionsOpen={directionsOpen}
        onToggleDirections={() => setDirectionsOpen((o) => !o)}
        directionsContent={
          upload.sectionDirections?.trim() ? (
            upload.sectionDirections
          ) : (
            <>
              Answer all parts in this section. You can mark parts for review and navigate with
              Back/Next. Click &quot;End Exam&quot; when you finish to submit for grading.
            </>
          )
        }
        timerVisible={timerVisible}
        timerPaused={timerPaused}
        elapsedSeconds={remainingSeconds}
        timerUrgent={timerUrgent}
        onToggleTimerPause={() => setTimerPaused((p) => !p)}
        onHideTimer={() => setTimerVisible(false)}
        onShowTimer={() => setTimerVisible(true)}
        toolbarPrimary={
          upload.isPubliclyVisible ? (
            <ExamShareButton
              examId={frqUploadId}
              examKind="frq"
              fullWidth={false}
              className="shrink-0 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
            />
          ) : null
        }
        toolbarOverflow={
          <>
            {upload.editorType === "code" && (
              <JavaQuickReferenceButton onClick={() => setJavaRefOpen(true)} />
            )}
            {headerToolbarExtras}
          </>
        }
        toolbar={
          <>
            {upload.isPubliclyVisible && (
              <ExamShareButton
                examId={frqUploadId}
                examKind="frq"
                fullWidth={false}
                className="shrink-0 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
              />
            )}
            {upload.editorType === "code" && (
              <JavaQuickReferenceButton onClick={() => setJavaRefOpen(true)} />
            )}
            {headerToolbarExtras}
          </>
        }
        sourceLine={
          showSourceAttribution ? (
            <ExamSourceLine
              sourceType={upload.sourceType ?? null}
              sourceName={upload.sourceName ?? null}
              sourceUrl={upload.sourceUrl}
            />
          ) : undefined
        }
      />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {hasMeaningfulLeftContent ? (
            <div className="flex shrink-0 border-b border-gray-200 bg-[#f2f5f9] md:hidden">
              <button
                type="button"
                onClick={() => setMobilePanelTab("passage")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                  mobilePanelTab === "passage"
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Stimulus
              </button>
              <button
                type="button"
                onClick={() => setMobilePanelTab("question")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                  mobilePanelTab === "question"
                    ? "border-b-2 border-blue-600 text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Response
              </button>
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 overflow-hidden">
          {hasMeaningfulLeftContent ? (
            <>
              <div
                className={cn(
                  "min-h-0 min-w-0 flex-shrink-0 overflow-auto border-r border-gray-300 bg-white",
                  mobilePanelTab === "passage" ? "flex-1 w-full md:block" : "hidden md:block"
                )}
                style={{ width: `${leftPanelPercent}%` }}
              >
                <div className="relative h-full min-w-0 p-4 select-none">
                  <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Question {currentQuestion.questionNumber}
                  </p>
                  <FrqLeftPanelContent
                    mode={leftPanelMode}
                    content={leftPanelHtml}
                    pdfUrl={pdfUrl}
                    pageNumber={currentPdfPageNumber}
                    questionKey={currentQuestion.id}
                  />
                </div>
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                className="group hidden w-1 flex-shrink-0 cursor-col-resize items-center justify-center bg-gray-300 hover:bg-gray-400 md:flex"
                onMouseDown={() => {
                  isDraggingRef.current = true;
                  window.addEventListener("mousemove", handleResize);
                  window.addEventListener("mouseup", handleResizeEnd);
                }}
              />

              <div
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col overflow-auto",
                  mobilePanelTab === "question" ? "flex" : "hidden md:flex"
                )}
                style={{ width: `${100 - leftPanelPercent}%` }}
              >
                {answerPanel}
              </div>
            </>
          ) : (
            <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-auto">
              {answerPanel}
            </div>
          )}
          </div>
        </main>

      <ExamFooter
        displayUsername={displayUsername}
        centerContent={
          <ExamFooterQuestionNav
            currentIndex={currentIndex}
            totalQuestions={flatItems.length}
            questionListOpen={questionListOpen}
            onToggleQuestionList={() => setQuestionListOpen((o) => !o)}
            onCloseQuestionList={() => setQuestionListOpen(false)}
            questionGrid={
              <div className="grid grid-cols-5 gap-1.5">
                {flatItems.map((item, i) => {
                  const key = responseKey(item.questionId, item.partLabel);
                  const isFlagged = flags[key] === true;
                  const hasResponse = Boolean(responses[key]?.trim());
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(i);
                        setQuestionListOpen(false);
                      }}
                      className={cn(
                        "relative h-9 min-w-9 rounded-md px-1 text-sm font-medium tabular-nums",
                        i === currentIndex
                          ? examUi.questionGridCurrent
                          : hasResponse
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {item.displayLabelCompact}
                      {isFlagged ? (
                        <Flag
                          className="absolute -right-0.5 -top-0.5 h-3 w-3 fill-amber-500 text-amber-600"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            }
          />
        }
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50",
                examUi.backGray
              )}
            >
              Back
            </button>
            {!isLastPart ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(flatItems.length - 1, i + 1))}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white",
                  examUi.nextBlue
                )}
              >
                Next
              </button>
            ) : (
              !isModeratorPreview ? (
              <button
                type="button"
                onClick={() => setShowEndExamConfirm(true)}
                disabled={submitting || grading}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium text-white",
                  submitting || grading
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {grading ? "Submitting…" : "End Exam"}
              </button>
              ) : null
            )}
          </div>
        }
      />

      {canReport && currentQuestion && attemptId && attemptId !== MODERATOR_PREVIEW_ATTEMPT_ID && (
        <QuestionReportFlow
          examKind="frq"
          frqQuestionId={currentQuestion.id}
          frqUploadId={frqUploadId}
          frqAttemptId={attemptId}
          questionNumber={currentQuestion.questionNumber}
          partLabel={currentItem.partLabel || undefined}
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
        />
      )}

      {showEndExamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Finish Section II?</h2>
            <FrqMarkedForReviewWarning items={flaggedItems} />
            {emptyResponseCount > 0 ? (
              <p className="mb-4 text-sm text-gray-700">
                {emptyResponseCount} part{emptyResponseCount === 1 ? " has" : "s have"} no response
                yet. You can still submit — AI will grade what you wrote.
              </p>
            ) : (
              <p className="mb-4 text-sm text-gray-700">
                You are about to submit this section for AI grading using official rubrics.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEndExamConfirm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || grading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Submit &amp; Grade
              </button>
            </div>
          </div>
        </div>
      )}

      {grading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-3 rounded-lg bg-white px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <p className="text-sm text-gray-800">
              AI is grading your responses using official rubrics…
            </p>
          </div>
        </div>
      )}

      <JavaQuickReferencePanel open={javaRefOpen} onClose={() => setJavaRefOpen(false)} />

      {pdfUrl && (
        <FullPageModal
          open={fullPageModalOpen}
          onClose={() => setFullPageModalOpen(false)}
          pdfUrl={pdfUrl}
          pageNumber={currentPdfPageNumber}
        />
      )}
    </div>
    </GraphZoomProvider>
  );
}
