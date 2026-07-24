"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { NotesDropzone } from "@/components/dashboard/NotesDropzone";
import { QuestionCountSelector } from "@/components/dashboard/QuestionCountSelector";
import { GenerateExamProgressOverlay } from "@/components/dashboard/GenerateExamProgressOverlay";
import { ConsentModal } from "@/components/ConsentModal";
import { type PhaseTiming } from "@/components/UploadAnalyzeProgress";
import { useDashboardAuth } from "@/components/library/DashboardAuthProvider";
import { createClient } from "@/lib/supabase/client";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/subjects";
import { getExamProgram } from "@/lib/exam-program";
import { cn } from "@/lib/utils";
import {
  buildClientNotesGeneratePhases,
  formatFriendlyAnalyzeError,
  PHASE_EXTRACT,
  PHASE_UPLOAD,
  type AnalyzeErrorDisplay,
  type AnalyzePhase,
  type ProgressEvent,
} from "@/lib/upload-analyze-progress";
import type { NotesDifficultyPreset } from "@/lib/notes-exam-prompt";
import {
  MAX_NOTES_TOTAL_BYTES,
  MAX_NOTES_TOTAL_MB,
} from "@/lib/notes-upload-limits";
import type { NotesStoredFileRef } from "@/lib/notes-storage";

const AP_SUBJECTS = SUBJECT_KEYS.filter((key) => getExamProgram(key) === "AP").map((value) => ({
  value,
  label: SUBJECT_LABELS[value],
}));

const DIFFICULTY_OPTIONS: Array<{ value: NotesDifficultyPreset; label: string; hint: string }> = [
  { value: "easy", label: "Easy", hint: "50% easy · 40% medium · 10% hard" },
  { value: "medium", label: "Medium", hint: "20% easy · 50% medium · 30% hard" },
  { value: "hard", label: "Hard", hint: "10% easy · 40% medium · 50% hard" },
];

export default function DashboardGeneratePage() {
  const router = useRouter();
  const { accessToken } = useDashboardAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [subject, setSubject] = useState<SubjectKey | "">("");
  const [questionCount, setQuestionCount] = useState(15);
  const [difficulty, setDifficulty] = useState<NotesDifficultyPreset>("medium");
  const [topicTitle, setTopicTitle] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dropzoneError, setDropzoneError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  const [showProgress, setShowProgress] = useState(false);
  const [analyzePhases, setAnalyzePhases] = useState<AnalyzePhase[]>([]);
  const [phaseTimings, setPhaseTimings] = useState<Record<string, PhaseTiming>>({});
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [overallStartedAt, setOverallStartedAt] = useState<number | null>(null);
  const [totalPredictedLabel, setTotalPredictedLabel] = useState<string | undefined>();
  const [analyzeError, setAnalyzeError] = useState<AnalyzeErrorDisplay | null>(null);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);

  const subjectLabel = subject ? (SUBJECT_LABELS[subject] ?? subject) : "";
  const difficultyLabel =
    DIFFICULTY_OPTIONS.find((option) => option.value === difficulty)?.label ?? difficulty;

  const canGenerate = useMemo(
    () => files.length > 0 && subject !== "" && questionCount >= 5 && questionCount <= 30,
    [files.length, subject, questionCount]
  );

  const dismissProgress = useCallback(() => {
    setShowProgress(false);
    setAnalyzePhases([]);
    setPhaseTimings({});
    setActivePhaseId(null);
    setOverallStartedAt(null);
    setAnalyzeError(null);
    setTotalPredictedLabel(undefined);
    setCompleteMessage(null);
    setIsGenerating(false);
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

  async function recordGenerateConsents(token: string): Promise<boolean> {
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
        context: { source: "notes_generate_exam", fileCount: files.length },
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

  async function runGenerate() {
    if (!canGenerate || !subject) return;

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_NOTES_TOTAL_BYTES) {
      const err = formatFriendlyAnalyzeError(
        `Total upload size exceeds ${MAX_NOTES_TOTAL_MB} MB. Remove a file or use smaller notes.`,
        {}
      );
      setAnalyzeError(err);
      setFormError(err.message);
      return;
    }

    const supabase = createClient();
    const started = Date.now();
    const { phases, totalPredictedLabel: predictedLabel } = buildClientNotesGeneratePhases();

    setIsGenerating(true);
    setFormError(null);
    setAnalyzeError(null);
    setShowProgress(true);
    setAnalyzePhases(phases);
    setPhaseTimings({
      [PHASE_UPLOAD]: { status: "active", startedAt: started },
    });
    setActivePhaseId(PHASE_UPLOAD);
    setOverallStartedAt(started);
    setTotalPredictedLabel(predictedLabel);

    const uploadStarted = Date.now();
    const uploadedFiles: NotesStoredFileRef[] = [];

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        setFormError("Please sign in again.");
        return;
      }

      for (const file of files) {
        const signedRes = await fetch("/api/notes/create-signed-url", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || undefined,
            size: file.size,
          }),
        });
        const signedData = (await signedRes.json().catch(() => ({}))) as {
          bucket?: string;
          storagePath?: string;
          signedUrl?: string;
          token?: string;
          error?: string;
        };

        if (
          !signedRes.ok ||
          !signedData.bucket ||
          !signedData.storagePath ||
          !signedData.token
        ) {
          const err = formatFriendlyAnalyzeError(
            signedData.error ?? "Could not initialize upload. Try again.",
            { failedPhaseId: PHASE_UPLOAD }
          );
          setAnalyzeError(err);
          setFormError(err.message);
          setPhaseTimings((prev) => ({
            ...prev,
            [PHASE_UPLOAD]: {
              status: "error",
              durationMs: Date.now() - uploadStarted,
              errorMessage: err.message,
              startedAt: uploadStarted,
            },
          }));
          return;
        }

        const contentType = file.type || "application/octet-stream";
        const { error: uploadStorageError } = await supabase.storage
          .from(signedData.bucket)
          .uploadToSignedUrl(signedData.storagePath, signedData.token, file, {
            contentType,
            upsert: true,
          });

        if (uploadStorageError) {
          const err = formatFriendlyAnalyzeError(
            uploadStorageError.message || "Upload failed.",
            { failedPhaseId: PHASE_UPLOAD }
          );
          setAnalyzeError(err);
          setFormError(err.message);
          setPhaseTimings((prev) => ({
            ...prev,
            [PHASE_UPLOAD]: {
              status: "error",
              durationMs: Date.now() - uploadStarted,
              errorMessage: err.message,
              startedAt: uploadStarted,
            },
          }));
          return;
        }

        uploadedFiles.push({
          storagePath: signedData.storagePath,
          filename: file.name,
          mimeType: contentType,
          sizeBytes: file.size,
        });
      }

      setPhaseTimings((prev) => ({
        ...prev,
        [PHASE_UPLOAD]: {
          status: "done",
          durationMs: Date.now() - uploadStarted,
          startedAt: uploadStarted,
        },
        [PHASE_EXTRACT]: {
          status: "active",
          startedAt: Date.now(),
        },
      }));
      setActivePhaseId(PHASE_EXTRACT);

      const res = await fetch("/api/notes/generate-exam", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          questionCount,
          difficulty,
          topicTitle: topicTitle.trim() || undefined,
          streamProgress: true,
          files: uploadedFiles,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        if (data.code === "CONSENT_REQUIRED") {
          setConsentOpen(true);
          dismissProgress();
          return;
        }
        const err = formatFriendlyAnalyzeError(data.error ?? "Exam generation failed.", {});
        setAnalyzeError(err);
        setFormError(err.message);
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

      if (!completeData?.examId) {
        if (!streamHadError) {
          const err = formatFriendlyAnalyzeError("Exam generation did not complete.", {});
          setAnalyzeError(err);
          setFormError(err.message);
        }
        return;
      }

      setCompleteMessage("Exam ready — opening your practice test…");
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.push(`/exam/${completeData.examId}`);
      dismissProgress();
    } catch (e) {
      const err = formatFriendlyAnalyzeError(
        e instanceof Error ? e.message : "Exam generation failed.",
        {}
      );
      setAnalyzeError(err);
      setFormError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function confirmConsent() {
    setConsentLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) return;
      const ok = await recordGenerateConsents(token);
      if (!ok) {
        setFormError("Could not save consent. Please try again.");
        return;
      }
      setConsentOpen(false);
      await runGenerate();
    } catch {
      setFormError("Could not save consent. Please try again.");
    } finally {
      setConsentLoading(false);
    }
  }

  function handleGenerateClick() {
    if (!canGenerate) return;
    setConsentOpen(true);
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Generate exam from notes</h1>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Upload your class notes and create an original AP-style practice test powered by AI.
        </p>
      </div>

      <div
        className={cn(
          "grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] transition-opacity",
          isGenerating && "pointer-events-none opacity-60"
        )}
      >
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <NotesDropzone
            files={files}
            onFilesChange={(next) => {
              setFiles(next);
              setDropzoneError(null);
            }}
            onValidationError={setDropzoneError}
            disabled={isGenerating}
            variant="hero"
            title="Your notes"
            description="Drag and drop PDF, DOCX, or TXT files, or click to browse"
          />
          {dropzoneError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {dropzoneError}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Exam settings</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="generate-subject" className="block text-xs font-medium text-gray-700">
                Subject
              </label>
              <select
                id="generate-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value as SubjectKey | "")}
                disabled={isGenerating}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select AP subject</option>
                {AP_SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <QuestionCountSelector
              value={questionCount}
              onChange={setQuestionCount}
              disabled={isGenerating}
            />

            <div>
              <p className="text-xs font-medium text-gray-700">Difficulty</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setDifficulty(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      difficulty === option.value
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-gray-500">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="generate-topic" className="block text-xs font-medium text-gray-700">
                Unit / topic title <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="generate-topic"
                type="text"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                disabled={isGenerating}
                placeholder="e.g. Unit 3 — Cellular Energetics"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {formError && !showProgress && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {formError}
            </p>
          )}

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={!canGenerate || isGenerating}
            className={cn(
              "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm",
              canGenerate && !isGenerating
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-blue-400"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating exam…
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Generate exam
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-500">
            Generated exams can be published after moderator review, same as uploaded PDFs.{" "}
            <Link href="/dashboard/library" className="text-blue-600 hover:underline">
              View library
            </Link>
          </p>
        </section>
      </div>

      <GenerateExamProgressOverlay
        open={showProgress && analyzePhases.length > 0}
        completeMessage={completeMessage}
        phases={analyzePhases}
        phaseTimings={phaseTimings}
        activePhaseId={activePhaseId}
        overallStartedAt={overallStartedAt}
        totalPredictedLabel={totalPredictedLabel}
        error={analyzeError}
        headline="Building your practice exam…"
        subtitle={
          subjectLabel
            ? `${subjectLabel} · ${questionCount} questions · ${difficultyLabel} difficulty`
            : undefined
        }
        onDismiss={dismissProgress}
        onTryAgain={analyzeError && !isGenerating ? () => void runGenerate() : undefined}
      />

      <ConsentModal
        open={consentOpen}
        title="AI exam generation consent"
        confirmLabel="I agree and generate"
        onConfirm={() => void confirmConsent()}
        onCancel={() => setConsentOpen(false)}
        loading={consentLoading}
      >
        <p>
          Your notes will be sent to Google Gemini to generate original AP-style practice questions.
          Generated content is stored on our servers. After moderator approval, this exam can be
          published to the public practice catalog.
        </p>
        <p className="mt-3">
          By continuing, you confirm these are your own notes or you have the right to use them, agree
          to{" "}
          <Link href="/privacy#ai-processing-and-pdf-content" className="text-blue-600 hover:underline">
            AI data processing
          </Link>
          , and consent to public sharing once a moderator approves the exam.
        </p>
      </ConsentModal>
    </>
  );
}
