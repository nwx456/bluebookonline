import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getClientIp } from "@/lib/auth-session";
import { generateWithFallback } from "@/lib/gemini-client";
import { SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";
import { getExamProgram } from "@/lib/exam-program";
import { hasActiveConsent, recordUploadPublishConsent } from "@/lib/legal/consent";
import {
  buildClientNotesGeneratePhases,
  createPhaseTracker,
  formatFriendlyAnalyzeError,
  PHASE_EXTRACT,
  PHASE_GENERATE,
  PHASE_SAVE,
  type ProgressEvent,
} from "@/lib/upload-analyze-progress";
import {
  buildGeminiContentsFromNotes,
  prepareNotesContent,
  validateNotesFiles,
  type NotesInputFile,
} from "@/lib/notes-extract";
import {
  loadNotesFilesFromStorage,
  type NotesStoredFileRef,
  validateNotesStoredFileRefs,
} from "@/lib/notes-storage";
import {
  buildNotesExamPrompt,
  type NotesDifficultyPreset,
} from "@/lib/notes-exam-prompt";
import {
  notesExamToQuestionRows,
  validateNotesExamResponse,
} from "@/lib/notes-exam-validate";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { logServerError } from "@/lib/error-logging";

export const maxDuration = 300;

const UPLOADS_BUCKET = "pdf_uploads";
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 30;
const VALID_DIFFICULTIES = new Set<NotesDifficultyPreset>(["easy", "medium", "hard"]);

class GenerateFailError extends Error {
  constructor(
    readonly status: number,
    readonly payload: Record<string, unknown>,
    readonly failedPhaseId?: string
  ) {
    super(String(payload.error ?? "Generation failed"));
  }
}

function throwFail(status: number, payload: Record<string, unknown>, failedPhaseId?: string): never {
  throw new GenerateFailError(status, payload, failedPhaseId);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "notes";
}

type GenerateExamBody = {
  subject?: unknown;
  questionCount?: unknown;
  difficulty?: unknown;
  topicTitle?: unknown;
  streamProgress?: unknown;
  files?: unknown;
};

function parseStoredFileRefs(raw: unknown): NotesStoredFileRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: NotesStoredFileRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const storagePath = typeof record.storagePath === "string" ? record.storagePath.trim() : "";
    const filename = typeof record.filename === "string" ? record.filename.trim() : "";
    const mimeType =
      typeof record.mimeType === "string" ? record.mimeType.trim() : "application/octet-stream";
    const sizeBytes = typeof record.sizeBytes === "number" ? record.sizeBytes : 0;
    if (!storagePath || !filename) continue;
    refs.push({ storagePath, filename, mimeType, sizeBytes });
  }
  return refs;
}

async function parseGenerateExamBody(request: NextRequest): Promise<{
  subject: SubjectKey;
  questionCount: number;
  difficulty: NotesDifficultyPreset;
  topicTitle: string | null;
  streamProgress: boolean;
  fileRefs: NotesStoredFileRef[];
}> {
  const body = (await request.json().catch(() => null)) as GenerateExamBody | null;
  if (!body || typeof body !== "object") {
    throwFail(400, { error: "Invalid JSON body." });
  }

  const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
  const questionCountRaw = Number(body.questionCount);
  const difficultyRaw = String(body.difficulty ?? "medium")
    .trim()
    .toLowerCase() as NotesDifficultyPreset;
  const topicTitle =
    typeof body.topicTitle === "string" && body.topicTitle.trim()
      ? body.topicTitle.trim()
      : null;
  const streamProgress = body.streamProgress === true;
  const fileRefs = parseStoredFileRefs(body.files);

  if (!SUBJECT_KEYS.includes(subjectRaw as SubjectKey)) {
    throwFail(400, { error: "Invalid subject." });
  }
  const subject = subjectRaw as SubjectKey;
  if (getExamProgram(subject) !== "AP") {
    throwFail(400, {
      error: "Notes exam generation is available for AP subjects only.",
    });
  }
  if (
    !Number.isInteger(questionCountRaw) ||
    questionCountRaw < MIN_QUESTIONS ||
    questionCountRaw > MAX_QUESTIONS
  ) {
    throwFail(400, {
      error: `Question count must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.`,
    });
  }
  if (!VALID_DIFFICULTIES.has(difficultyRaw)) {
    throwFail(400, { error: "Invalid difficulty." });
  }

  const refsValidation = validateNotesStoredFileRefs(fileRefs);
  if (!refsValidation.ok) {
    throwFail(400, { error: refsValidation.error });
  }

  return {
    subject,
    questionCount: questionCountRaw,
    difficulty: difficultyRaw,
    topicTitle,
    streamProgress,
    fileRefs,
  };
}

async function performNotesGenerate(
  opts: {
    files: NotesInputFile[];
    subject: SubjectKey;
    questionCount: number;
    difficulty: NotesDifficultyPreset;
    topicTitle: string | null;
    userEmail: string;
    request: NextRequest;
  },
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  tracker: ReturnType<typeof createPhaseTracker> | null
): Promise<{ examId: string; questionCount: number; warnings: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throwFail(500, { error: "GEMINI_API_KEY is not set." });
  }

  const validation = validateNotesFiles(
    opts.files.map((f) => ({ name: f.name, size: f.buffer.length, kind: f.kind }))
  );
  if (!validation.ok) {
    throwFail(400, { error: validation.error });
  }

  let prepared;
  try {
    prepared = await (tracker
      ? tracker.runWithHeartbeat(PHASE_EXTRACT, () =>
          prepareNotesContent({ files: opts.files, apiKey })
        )
      : prepareNotesContent({ files: opts.files, apiKey }));
    if (tracker) {
      tracker.done(
        PHASE_EXTRACT,
        `${opts.files.length} file${opts.files.length === 1 ? "" : "s"} prepared`
      );
    }
  } catch (e) {
    throwFail(
      500,
      { error: e instanceof Error ? e.message : "Failed to read notes files." },
      PHASE_EXTRACT
    );
  }

  const prompt = buildNotesExamPrompt({
    subject: opts.subject,
    questionCount: opts.questionCount,
    difficulty: opts.difficulty,
    topicTitle: opts.topicTitle,
    truncationNotice: prepared.truncationNotice,
  });

  const contents = buildGeminiContentsFromNotes(prepared, prompt);

  let geminiText: string;
  try {
    const result = await (tracker
      ? tracker.runWithHeartbeat(PHASE_GENERATE, async () =>
          generateWithFallback({
            apiKey,
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: 65536,
              temperature: 0.7,
            },
          })
        )
      : generateWithFallback({
          apiKey,
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 65536,
            temperature: 0.7,
          },
        }));
    geminiText = result.text;
    if (tracker) tracker.done(PHASE_GENERATE, `${opts.questionCount} questions requested`);
  } catch (e) {
    throwFail(
      502,
      {
        error: e instanceof Error ? e.message : "AI generation failed.",
        errorCode: "GEMINI_FAILED",
      },
      PHASE_GENERATE
    );
  }

  const validated = validateNotesExamResponse({
    raw: geminiText,
    requestedCount: opts.questionCount,
    difficulty: opts.difficulty,
  });

  if (!validated.ok) {
    throwFail(
      422,
      {
        error: validated.message,
        errorCode: validated.errorCode,
        rawTextLen: validated.rawTextLen,
      },
      PHASE_GENERATE
    );
  }

  const exam = validated.exam;
  const warnings = [...validated.warnings];
  if (prepared.truncationNotice) warnings.push(prepared.truncationNotice);

  const displayTitle =
    opts.topicTitle?.trim() || exam.topic_title || `${opts.subject} Practice Exam`;
  const combinedPreview = prepared.textBlocks.join("\n\n").slice(0, 50_000);
  const publishRequestedAt = new Date().toISOString();

  let uploadId: string;
  try {
    uploadId = await (tracker
      ? tracker.runWithHeartbeat(PHASE_SAVE, async () => {
          const { data: uploadRow, error: uploadError } = await supabase
            .from("pdf_uploads")
            .insert({
              user_email: opts.userEmail,
              filename: displayTitle,
              storage_path: `notes/pending/${sanitizeFilename(displayTitle)}`,
              subject: opts.subject,
              original_text: combinedPreview,
              is_published: false,
              moderation_status: "pending_review",
              publish_requested_at: publishRequestedAt,
              exam_program: "AP",
              requested_question_count: opts.questionCount,
              origin: "notes_generated",
              generated_topic: exam.topic_title,
              generated_difficulty: opts.difficulty,
              not_official_material_confirmed: true,
            })
            .select("id")
            .single();

          if (uploadError || !uploadRow?.id) {
            throw new Error(uploadError?.message ?? "Failed to save upload record.");
          }
          return uploadRow.id as string;
        })
      : (async () => {
          const { data: uploadRow, error: uploadError } = await supabase
            .from("pdf_uploads")
            .insert({
              user_email: opts.userEmail,
              filename: displayTitle,
              storage_path: `notes/pending/${sanitizeFilename(displayTitle)}`,
              subject: opts.subject,
              original_text: combinedPreview,
              is_published: false,
              moderation_status: "pending_review",
              publish_requested_at: publishRequestedAt,
              exam_program: "AP",
              requested_question_count: opts.questionCount,
              origin: "notes_generated",
              generated_topic: exam.topic_title,
              generated_difficulty: opts.difficulty,
              not_official_material_confirmed: true,
            })
            .select("id")
            .single();

          if (uploadError || !uploadRow?.id) {
            throw new Error(uploadError?.message ?? "Failed to save upload record.");
          }
          return uploadRow.id as string;
        })());
  } catch (e) {
    throwFail(
      500,
      { error: e instanceof Error ? e.message : "Failed to save exam." },
      PHASE_SAVE
    );
  }

  await recordUploadPublishConsent(supabase, {
    userEmail: opts.userEmail,
    uploadId,
    ip: getClientIp(opts.request),
    userAgent: opts.request.headers.get("user-agent"),
    source: "notes_generate_exam",
  });

  const storagePrefix = `notes/${uploadId}`;
  let primaryStoragePath: string | null = null;

  for (const file of opts.files) {
    const key = `${storagePrefix}/${sanitizeFilename(file.name)}`;
    try {
      const { error: storageError } = await supabase.storage
        .from(UPLOADS_BUCKET)
        .upload(key, file.buffer, {
          contentType: file.mimeType,
          upsert: true,
        });
      if (storageError) {
        console.error("notes storage upload error:", storageError);
      } else if (!primaryStoragePath) {
        primaryStoragePath = key;
      }
    } catch (e) {
      console.error("notes storage error:", e);
    }
  }

  if (primaryStoragePath) {
    await supabase
      .from("pdf_uploads")
      .update({ storage_path: primaryStoragePath })
      .eq("id", uploadId);
  }

  const rows = notesExamToQuestionRows(uploadId, exam);
  const { error: questionsError } = await supabase.from("questions").insert(rows);
  if (questionsError) {
    console.error("notes questions insert error:", questionsError);
    await supabase.from("pdf_uploads").delete().eq("id", uploadId);
    throwFail(500, { error: "Failed to save generated questions." }, PHASE_SAVE);
  }

  await supabase
    .from("pdf_uploads")
    .update({
      requested_question_count: rows.length,
      answer_key_from_pdf_count: rows.length,
    })
    .eq("id", uploadId);

  if (tracker) tracker.done(PHASE_SAVE, `${rows.length} questions saved`);

  return {
    examId: uploadId,
    questionCount: rows.length,
    warnings,
  };
}

export async function POST(request: NextRequest) {
  let logUser: { id?: string; email?: string | null } | null = null;
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Authentication required." }, { status: 401 });
    }

    logUser = { id: user.id, email: user.email };

    const userEmail = user.email.trim().toLowerCase();
    const parsed = await parseGenerateExamBody(request);

    const supabase = createServerSupabaseAdmin();
    const { data: userRow, error: userCheckError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (userCheckError || !userRow) {
      return NextResponse.json(
        { error: "Account not fully set up. Please sign in again." },
        { status: 403 }
      );
    }

    const hasAiConsent = await hasActiveConsent(supabase, userEmail, "ai_processing");
    const hasCopyrightConsent = await hasActiveConsent(supabase, userEmail, "copyright_attestation");
    const hasPublishConsent = await hasActiveConsent(supabase, userEmail, "public_publish");
    if (!hasAiConsent || !hasCopyrightConsent || !hasPublishConsent) {
      return NextResponse.json(
        {
          error: "Upload consent required. Please accept the consent dialog on the dashboard.",
          code: "CONSENT_REQUIRED",
        },
        { status: 403 }
      );
    }

    let files: NotesInputFile[];
    try {
      files = await loadNotesFilesFromStorage(supabase, userEmail, parsed.fileRefs);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not read uploaded notes.";
      const status = message === "Invalid storage path." ? 403 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const input = {
      files,
      subject: parsed.subject,
      questionCount: parsed.questionCount,
      difficulty: parsed.difficulty,
      topicTitle: parsed.topicTitle,
      userEmail,
      request,
    };

    if (parsed.streamProgress) {
      const { phases } = buildClientNotesGeneratePhases();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: ProgressEvent) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          };
          const tracker = createPhaseTracker(emit);
          tracker.init(phases, Date.now());
          try {
            const result = await performNotesGenerate(input, supabase, tracker);
            tracker.complete({
              type: "complete",
              examId: result.examId,
              questionCount: result.questionCount,
              moduleSummary:
                result.warnings.length > 0 ? result.warnings.join(" ") : undefined,
            });
          } catch (e) {
            if (e instanceof GenerateFailError) {
              tracker.error(
                formatFriendlyAnalyzeError(String(e.payload.error ?? e.message), {
                  failedPhaseId: e.failedPhaseId,
                  errorCode:
                    typeof e.payload.errorCode === "string" ? e.payload.errorCode : undefined,
                  rawTextLen:
                    typeof e.payload.rawTextLen === "number" ? e.payload.rawTextLen : undefined,
                })
              );
            } else {
              tracker.error(
                formatFriendlyAnalyzeError(
                  e instanceof Error ? e.message : "Exam generation failed.",
                  {}
                )
              );
            }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-cache",
        },
      });
    }

    const result = await performNotesGenerate(input, supabase, null);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GenerateFailError) {
      return NextResponse.json(err.payload, { status: err.status });
    }
    void logServerError(err, {
      request,
      endpoint: "/api/notes/generate-exam",
      user: logUser,
    });
    console.error("notes generate-exam error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Exam generation failed." },
      { status: 500 }
    );
  }
}
