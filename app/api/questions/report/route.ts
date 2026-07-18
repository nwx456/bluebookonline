import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/admin-mail-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { validateQuestionReportInput } from "@/lib/question-report-reasons";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const examKind = (body.examKind ?? body.exam_kind ?? "mcq") as string;
    const partLabel = (body.partLabel ?? body.part_label ?? "") as string;

    const validation = validateQuestionReportInput({
      reasonCodes: body.reasonCodes ?? body.reason_codes,
      customNote: body.customNote ?? body.custom_note,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const userEmail = normalizeEmail(user.email);
    const supabase = createServerSupabaseAdmin();
    const now = new Date().toISOString();

    if (examKind === "frq") {
      const frqQuestionId = (body.frqQuestionId ?? body.frq_question_id ?? body.questionId) as string | undefined;
      const frqUploadId = (body.frqUploadId ?? body.frq_upload_id ?? body.uploadId) as string | undefined;
      const frqAttemptId = (body.frqAttemptId ?? body.frq_attempt_id ?? body.attemptId) as string | undefined;

      if (!frqQuestionId?.trim() || !frqUploadId?.trim() || !frqAttemptId?.trim()) {
        return NextResponse.json(
          { error: "frqQuestionId, frqUploadId, and frqAttemptId are required." },
          { status: 400 }
        );
      }

      const { data: question, error: questionError } = await supabase
        .from("frq_questions")
        .select("id, frq_upload_id")
        .eq("id", frqQuestionId)
        .eq("frq_upload_id", frqUploadId)
        .maybeSingle();

      if (questionError || !question) {
        return NextResponse.json({ error: "Question not found." }, { status: 404 });
      }

      const { data: attempt, error: attemptError } = await supabase
        .from("frq_attempts")
        .select("id, user_email, frq_upload_id, status, completed_at")
        .eq("id", frqAttemptId)
        .maybeSingle();

      if (attemptError || !attempt) {
        return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
      }

      if (normalizeEmail(attempt.user_email as string) !== userEmail) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }

      if ((attempt.frq_upload_id as string) !== frqUploadId) {
        return NextResponse.json({ error: "Attempt does not match this exam." }, { status: 400 });
      }

      if (attempt.status !== "in_progress" || attempt.completed_at) {
        return NextResponse.json(
          { error: "Reports can only be submitted during an active exam." },
          { status: 400 }
        );
      }

      const { data: existing } = await supabase
        .from("question_reports")
        .select("id")
        .eq("exam_kind", "frq")
        .eq("user_email", userEmail)
        .eq("frq_question_id", frqQuestionId)
        .eq("frq_attempt_id", frqAttemptId)
        .eq("part_label", partLabel || "")
        .maybeSingle();

      const reportPayload = {
        exam_kind: "frq" as const,
        frq_question_id: frqQuestionId,
        frq_upload_id: frqUploadId,
        frq_attempt_id: frqAttemptId,
        part_label: partLabel || null,
        question_id: null,
        upload_id: null,
        attempt_id: null,
        user_email: userEmail,
        reason_codes: validation.reasonCodes,
        custom_note: validation.customNote,
        status: "open" as const,
        updated_at: now,
      };

      const { error: upsertError } = existing
        ? await supabase.from("question_reports").update(reportPayload).eq("id", existing.id)
        : await supabase.from("question_reports").insert(reportPayload);

      if (upsertError) {
        console.error("frq question_reports upsert error:", upsertError);
        return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
      }

      return NextResponse.json({ ok: true }, { status: 202 });
    }

    const questionId = (body.questionId ?? body.question_id) as string | undefined;
    const uploadId = (body.uploadId ?? body.upload_id) as string | undefined;
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;

    if (!questionId?.trim() || !uploadId?.trim() || !attemptId?.trim()) {
      return NextResponse.json(
        { error: "questionId, uploadId, and attemptId are required." },
        { status: 400 }
      );
    }

    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("id, upload_id")
      .eq("id", questionId)
      .eq("upload_id", uploadId)
      .maybeSingle();

    if (questionError || !question) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, user_email, upload_id, completed_at")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (normalizeEmail(attempt.user_email as string) !== userEmail) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if ((attempt.upload_id as string) !== uploadId) {
      return NextResponse.json({ error: "Attempt does not match this exam." }, { status: 400 });
    }

    if (attempt.completed_at) {
      return NextResponse.json(
        { error: "Reports can only be submitted during an active exam." },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase.from("question_reports").upsert(
      {
        exam_kind: "mcq",
        question_id: questionId,
        upload_id: uploadId,
        attempt_id: attemptId,
        user_email: userEmail,
        reason_codes: validation.reasonCodes,
        custom_note: validation.customNote,
        status: "open",
        updated_at: now,
      },
      { onConflict: "user_email,question_id,attempt_id" }
    );

    if (upsertError) {
      console.error("question_reports upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to submit report." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    console.error("POST /api/questions/report error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  const { QUESTION_REPORT_REASONS } = await import("@/lib/question-report-reasons");
  return NextResponse.json({ reasons: QUESTION_REPORT_REASONS });
}
