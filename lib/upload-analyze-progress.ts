import {
  getExamProgram,
  isSatFullTest,
  isSatMath,
  isSatRw,
  SAT_MODULES,
  type SatAdaptiveMode,
} from "@/lib/exam-program";
import { buildSatExtractionPlan } from "@/lib/sat-extraction";
import { bucketKey, type SatModuleBucket } from "@/lib/sat-module-normalizer";

export type PhaseStatus = "pending" | "active" | "done" | "error";

export interface AnalyzePhase {
  id: string;
  label: string;
  shortLabel?: string;
  predictedTimeLabel: string;
}

export interface AnalyzeErrorDisplay {
  failedPhaseId?: string;
  title: string;
  message: string;
  reason: string;
  suggestion: string;
  errorCode?: string;
  moduleSummary?: string;
  modeMismatchWarning?: string;
}

export type ProgressEvent =
  | { type: "init"; phases: AnalyzePhase[]; startedAt: number; totalPredictedLabel?: string }
  | { type: "phase_start"; phaseId: string; at: number }
  | { type: "phase_done"; phaseId: string; at: number; durationMs: number; detail?: string }
  | { type: "phase_error"; phaseId: string; at: number; message: string }
  | { type: "heartbeat"; activePhaseId: string; at: number }
  | { type: "complete"; examId: string; questionCount: number; moduleSummary?: string; modeMismatchWarning?: string; moduleCounts?: unknown; moduleReport?: unknown; detectedLabels?: string[] }
  | ({ type: "error" } & AnalyzeErrorDisplay);

export const PHASE_UPLOAD = "upload";
export const PHASE_DISCOVERY = "discovery";
export const PHASE_VALIDATE = "validate";
export const PHASE_SAVE = "save";
export const PHASE_EXTRACT = "extract";

export function bucketPhaseId(bucket: SatModuleBucket): string {
  return `bucket:${bucketKey(bucket)}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function bucketDisplayLabel(bucket: SatModuleBucket): { label: string; shortLabel: string } {
  const base = SAT_MODULES.find((m) => m.section === bucket.section && m.module === bucket.module);
  const baseLabel = base?.label ?? `${bucket.section === "rw" ? "Reading & Writing" : "Math"} – Module ${bucket.module}`;
  const short = base?.shortLabel ?? `${bucket.section === "rw" ? "R&W" : "Math"} M${bucket.module}`;
  if (bucket.module === 2 && bucket.variant) {
    const v = bucket.variant === "easy" ? "Easy" : "Hard";
    return {
      label: `${baseLabel} (${v})`,
      shortLabel: `${short} ${v}`,
    };
  }
  return { label: baseLabel, shortLabel: short };
}

function totalPredictedLabel(phases: AnalyzePhase[], subject?: string): string {
  const serverPhases = phases.filter((p) => p.id !== PHASE_UPLOAD);
  const bucketCount = serverPhases.filter((p) => p.id.startsWith("bucket:")).length;
  if (bucketCount >= 6) return "About 8–10 min total";
  if (bucketCount >= 4) return "About 6–8 min total";
  if (bucketCount === 0 && serverPhases.some((p) => p.id === PHASE_EXTRACT)) {
    const extract = serverPhases.find((p) => p.id === PHASE_EXTRACT);
    if (
      (subject && getExamProgram(subject) === "AP") ||
      extract?.label === "Analyzing PDF with AI"
    ) {
      return "About 2–4 min total";
    }
    return "About 2–3 min total";
  }
  return "About 2–4 min total";
}

function uploadPhase(): AnalyzePhase {
  return {
    id: PHASE_UPLOAD,
    label: "Uploading PDF",
    shortLabel: "Upload",
    predictedTimeLabel: "~15 sec",
  };
}

function discoveryPhase(): AnalyzePhase {
  return {
    id: PHASE_DISCOVERY,
    label: "Scanning PDF structure",
    shortLabel: "Structure",
    predictedTimeLabel: "~30 sec",
  };
}

function bucketPhase(bucket: SatModuleBucket): AnalyzePhase {
  const { label, shortLabel } = bucketDisplayLabel(bucket);
  return {
    id: bucketPhaseId(bucket),
    label: `Extracting ${label}`,
    shortLabel: `Extract ${shortLabel}`,
    predictedTimeLabel: "~1 min",
  };
}

function validatePhase(): AnalyzePhase {
  return {
    id: PHASE_VALIDATE,
    label: "Validating modules",
    shortLabel: "Validate",
    predictedTimeLabel: "~5 sec",
  };
}

function savePhase(): AnalyzePhase {
  return {
    id: PHASE_SAVE,
    label: "Saving exam",
    shortLabel: "Save",
    predictedTimeLabel: "~15 sec",
  };
}

function extractPhase(subject: string): AnalyzePhase {
  const label = isSatRw(subject)
    ? "Extracting Reading & Writing questions"
    : isSatMath(subject)
      ? "Extracting Math questions"
      : "Analyzing PDF with AI";
  return {
    id: PHASE_EXTRACT,
    label,
    shortLabel: "Extract",
    predictedTimeLabel: isSatRw(subject) || isSatMath(subject) ? "~2 min" : "~2–4 min",
  };
}

export function buildSatFullAnalyzePhases(adaptiveMode: SatAdaptiveMode): AnalyzePhase[] {
  const plan = buildSatExtractionPlan(adaptiveMode, null);
  return [
    uploadPhase(),
    discoveryPhase(),
    ...plan.map(bucketPhase),
    validatePhase(),
    savePhase(),
  ];
}

export function buildSingleSatAnalyzePhases(subject: string): AnalyzePhase[] {
  return [uploadPhase(), extractPhase(subject), savePhase()];
}

export function buildApAnalyzePhases(): AnalyzePhase[] {
  return [uploadPhase(), extractPhase(""), savePhase()];
}

export function buildClientAnalyzePhases(opts: {
  subject: string;
  satAdaptiveMode: SatAdaptiveMode;
}): { phases: AnalyzePhase[]; totalPredictedLabel: string } {
  const program = getExamProgram(opts.subject);
  let phases: AnalyzePhase[];
  if (program === "SAT" && isSatFullTest(opts.subject)) {
    phases = buildSatFullAnalyzePhases(opts.satAdaptiveMode);
  } else if (program === "SAT") {
    phases = buildSingleSatAnalyzePhases(opts.subject);
  } else {
    phases = buildApAnalyzePhases();
  }
  return { phases, totalPredictedLabel: totalPredictedLabel(phases, opts.subject) };
}

export interface FriendlyErrorContext {
  failedPhaseId?: string;
  statusCode?: number;
  moduleSummary?: string;
  modeMismatchWarning?: string;
  emptyBuckets?: string[];
}

export function formatFriendlyAnalyzeError(
  raw: string,
  ctx: FriendlyErrorContext = {}
): AnalyzeErrorDisplay {
  const lower = raw.toLowerCase();

  if (lower.includes("pdf'ten tam sat") || lower.includes("eksik") || lower.includes("boş modül") || ctx.emptyBuckets?.length) {
    const buckets = ctx.emptyBuckets?.join(", ") ?? "one or more modules";
    return {
      failedPhaseId: ctx.failedPhaseId ?? PHASE_VALIDATE,
      title: "Incomplete module extraction",
      message: "We could not extract questions from every expected module.",
      reason: `The AI returned no questions for: ${buckets}. This often means the PDF layout does not match the selected adaptive mode, or module headings were not detected.`,
      suggestion:
        "Check that your adaptive mode matches the PDF (six-module vs standard). Try a cleaner, text-based PDF or upload a single-module practice test instead.",
      errorCode: "MODULE_VALIDATION",
      moduleSummary: ctx.moduleSummary,
      modeMismatchWarning: ctx.modeMismatchWarning,
    };
  }

  if (lower.includes("no questions") || lower.includes("sorusu çıkarılamadı") || lower.includes("zero questions")) {
    return {
      failedPhaseId: ctx.failedPhaseId ?? PHASE_EXTRACT,
      title: "No questions found",
      message: "We could not find any extractable questions in this PDF.",
      reason:
        "The PDF may be scanned as images only, use an unexpected layout, or be too large for the AI to parse in one pass.",
      suggestion:
        "Use a text-based PDF, reduce file size, or try uploading a single SAT module instead of a full test.",
      errorCode: "ZERO_QUESTIONS",
      modeMismatchWarning: ctx.modeMismatchWarning,
    };
  }

  if (lower.includes("parse") && lower.includes("json")) {
    return {
      failedPhaseId: ctx.failedPhaseId ?? PHASE_EXTRACT,
      title: "AI response error",
      message: "The AI returned a response we could not parse.",
      reason: "The model output was not valid JSON — this can happen with very long or complex PDFs.",
      suggestion: "Try again, compress the PDF, or switch to a smaller section of the exam.",
      errorCode: "PARSE_ERROR",
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("no content")
  ) {
    return {
      failedPhaseId: ctx.failedPhaseId,
      title: "Analysis timed out",
      message: "The analysis did not finish in time.",
      reason: "The AI service or server stopped responding before extraction completed.",
      suggestion: "Wait a minute and try again. Large full-test PDFs can take 15+ minutes.",
      errorCode: "TIMEOUT",
    };
  }

  if (lower.includes("failed to save") || lower.includes("storage") || lower.includes("upload record")) {
    return {
      failedPhaseId: ctx.failedPhaseId ?? PHASE_SAVE,
      title: "Could not save exam",
      message: "Questions were extracted but saving to your library failed.",
      reason: "A database or file storage error occurred while saving your exam.",
      suggestion: "Try again. If the problem persists, contact support.",
      errorCode: "SAVE_ERROR",
    };
  }

  if (lower.includes("download") || lower.includes("connection")) {
    return {
      failedPhaseId: ctx.failedPhaseId ?? PHASE_UPLOAD,
      title: "Connection lost",
      message: "The upload or analysis connection was interrupted.",
      reason: "Network or server connectivity failed during the process.",
      suggestion: "Check your internet connection and try again.",
      errorCode: "CONNECTION",
    };
  }

  return {
    failedPhaseId: ctx.failedPhaseId,
    title: "Analysis failed",
    message: raw.slice(0, 200) || "Something went wrong during PDF analysis.",
    reason: raw || "An unexpected error occurred.",
    suggestion: "Try again with a smaller or cleaner PDF.",
    errorCode: "UNKNOWN",
    moduleSummary: ctx.moduleSummary,
    modeMismatchWarning: ctx.modeMismatchWarning,
  };
}

export type ProgressEmitter = (event: ProgressEvent) => void;

export function createPhaseTracker(emit: ProgressEmitter) {
  const phaseStarts = new Map<string, number>();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let activePhaseId: string | null = null;

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat(phaseId: string) {
    stopHeartbeat();
    activePhaseId = phaseId;
    heartbeatTimer = setInterval(() => {
      if (activePhaseId) {
        emit({ type: "heartbeat", activePhaseId, at: Date.now() });
      }
    }, 5000);
  }

  return {
    init(phases: AnalyzePhase[], startedAt: number) {
      emit({
        type: "init",
        phases: phases.filter((p) => p.id !== PHASE_UPLOAD),
        startedAt,
        totalPredictedLabel: totalPredictedLabel(phases),
      });
    },
    start(phaseId: string) {
      phaseStarts.set(phaseId, Date.now());
      emit({ type: "phase_start", phaseId, at: Date.now() });
      startHeartbeat(phaseId);
    },
    done(phaseId: string, detail?: string) {
      const started = phaseStarts.get(phaseId) ?? Date.now();
      const durationMs = Date.now() - started;
      stopHeartbeat();
      emit({ type: "phase_done", phaseId, at: Date.now(), durationMs, detail });
    },
    fail(phaseId: string, message: string) {
      stopHeartbeat();
      emit({ type: "phase_error", phaseId, at: Date.now(), message });
    },
    complete(payload: Extract<ProgressEvent, { type: "complete" }>) {
      stopHeartbeat();
      emit(payload);
    },
    error(display: AnalyzeErrorDisplay) {
      stopHeartbeat();
      emit({ type: "error", ...display });
    },
    async runWithHeartbeat<T>(phaseId: string, fn: () => Promise<T>): Promise<T> {
      this.start(phaseId);
      try {
        return await fn();
      } catch (e) {
        this.fail(phaseId, e instanceof Error ? e.message : "Failed");
        throw e;
      }
    },
  };
}

export function getActivePhaseHint(phase: AnalyzePhase | undefined): string {
  if (!phase) return "Working on your PDF…";
  return `${phase.label}…`;
}
