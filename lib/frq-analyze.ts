import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { generateWithFallback, buildPdfPart } from "@/lib/gemini-client";
import {
  getFrqExtractionSystemPrompt,
  parseFrqExtractionResponse,
  type FrqExtractedQuestion,
} from "@/lib/frq-prompts";
import { getFrqCourse, isFrqCourseId, type FrqCourseId } from "@/lib/frq-courses";
import { parseExamSourceFields } from "@/lib/exam-source";
import {
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";

const UPLOADS_BUCKET = "pdf_uploads";

function isUserFrqStoragePath(path: string, email: string): boolean {
  const prefix = `frq/${email}/`;
  return path.startsWith(prefix) && !path.includes("..");
}

function normalizeParts(parts: FrqExtractedQuestion["parts"]): Array<{
  label: string;
  prompt: string;
  max_points?: number;
}> {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [{ label: "", prompt: "", max_points: undefined }];
  }
  return parts.map((p) => ({
    label: String(p.label ?? "").trim(),
    prompt: String(p.prompt ?? "").trim(),
    max_points: typeof p.max_points === "number" ? p.max_points : undefined,
  }));
}

export async function handleFrqAnalyze(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getAuthUser(request);
    if (!auth.user?.email) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    const userEmail = normalizeEmail(auth.user.email);

    const body = (await request.json().catch(() => null)) as {
      courseId?: string;
      title?: string;
      storagePath?: string;
      rubricStoragePath?: string;
      sourceType?: string;
      sourceName?: string;
      sourceUrl?: string;
      notOfficialConfirmed?: boolean;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const courseId = body.courseId?.trim() ?? "";
    const title = body.title?.trim() ?? "FRQ Exam";
    const storagePath = body.storagePath?.trim() ?? "";
    const rubricStoragePath = body.rubricStoragePath?.trim() || null;

    if (!isFrqCourseId(courseId)) {
      return NextResponse.json({ error: "Invalid or unsupported FRQ course." }, { status: 400 });
    }
    if (!storagePath) {
      return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
    }
    if (!isUserFrqStoragePath(storagePath, userEmail)) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 403 });
    }
    if (rubricStoragePath && !isUserFrqStoragePath(rubricStoragePath, userEmail)) {
      return NextResponse.json({ error: "Invalid rubric storage path." }, { status: 403 });
    }

    const sourceResult = parseExamSourceFields({
      sourceType: body.sourceType,
      sourceName: body.sourceName,
      sourceUrl: body.sourceUrl,
      notOfficialConfirmed: body.notOfficialConfirmed,
    });
    if (!sourceResult.ok) {
      return NextResponse.json({ error: sourceResult.error }, { status: 400 });
    }
    const source = sourceResult.normalized;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: userRow } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (!userRow) {
      return NextResponse.json({ error: "Account not found." }, { status: 403 });
    }

    const { data: uploadRow, error: insertError } = await supabase
      .from("frq_uploads")
      .insert({
        user_email: userEmail,
        course_id: courseId,
        title,
        storage_path: storagePath,
        rubric_storage_path: rubricStoragePath,
        status: "processing",
        source_type: source.sourceType,
        source_name: source.sourceName,
        source_url: source.sourceUrl,
        not_official_material_confirmed: source.notOfficialConfirmed,
        moderation_status: "pending_review",
        publish_requested_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !uploadRow) {
      console.error("frq upload insert:", insertError);
      return NextResponse.json({ error: "Failed to create FRQ upload record." }, { status: 500 });
    }

    const uploadId = uploadRow.id as string;

    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(UPLOADS_BUCKET)
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error("Could not download PDF from storage.");
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      if (buffer.length > MAX_PDF_UPLOAD_BYTES) {
        throw new Error(`PDF exceeds ${MAX_PDF_UPLOAD_MB} MB limit.`);
      }

      const pdfPart = await buildPdfPart({
        apiKey,
        buffer,
        mimeType: "application/pdf",
        displayName: title,
      });

      const systemPrompt = getFrqExtractionSystemPrompt(courseId as FrqCourseId);
      const { text } = await generateWithFallback({
        apiKey,
        systemInstruction: systemPrompt,
        contents: [
          pdfPart,
          "Extract all Free Response Questions from this PDF. Return only the JSON array.",
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const extracted = parseFrqExtractionResponse(text);
      if (extracted.length === 0) {
        throw new Error("No FRQ questions could be extracted from the document.");
      }

      const course = getFrqCourse(courseId)!;
      let totalMaxScore = 0;

      const questionRows = extracted.map((q, idx) => {
        const parts = normalizeParts(q.parts);
        const maxPoints =
          typeof q.max_points === "number" && q.max_points > 0
            ? q.max_points
            : parts.reduce((sum, p) => sum + (p.max_points ?? 0), 0) ||
              course.questions[idx]?.maxPoints ||
              6;
        totalMaxScore += maxPoints;

        return {
          frq_upload_id: uploadId,
          question_number: q.question_number ?? idx + 1,
          question_type: q.question_type || course.questions[idx]?.type || "generic",
          prompt_html: q.prompt_html || "",
          stimulus_html: q.stimulus_html ?? null,
          parts,
          max_points: maxPoints,
          scoring_guidelines: q.scoring_guidelines ?? null,
          page_refs: q.page_refs ?? null,
        };
      });

      const { error: qError } = await supabase.from("frq_questions").insert(questionRows);
      if (qError) throw new Error("Failed to save extracted questions.");

      await supabase
        .from("frq_uploads")
        .update({
          status: "ready",
          question_count: questionRows.length,
          max_score: totalMaxScore,
          section_duration_min: course.sectionDurationMin,
        })
        .eq("id", uploadId);

      return NextResponse.json({
        uploadId,
        questionCount: questionRows.length,
        maxScore: totalMaxScore,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      await supabase
        .from("frq_uploads")
        .update({ status: "failed", error_message: message })
        .eq("id", uploadId);
      return NextResponse.json({ error: message, uploadId }, { status: 422 });
    }
  } catch (err) {
    console.error("frq analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
