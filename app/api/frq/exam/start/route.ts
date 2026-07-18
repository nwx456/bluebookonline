import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { canAccessFrqUpload, resolveFrqAssignmentAccess } from "@/lib/frq-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { computeIsLate } from "@/lib/late-submission";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const frqUploadId = (body.frqUploadId ?? body.frq_upload_id) as string | undefined;
    const userEmail = (body.userEmail ?? body.user_email) as string | undefined;
    const assignmentId = (body.assignmentId ?? body.assignment_id) as string | undefined;

    if (!frqUploadId?.trim() || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "frqUploadId and userEmail are required." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const email = normalizeEmail(userEmail);

    const { data: upload } = await supabase
      .from("frq_uploads")
      .select("id, status, max_score, user_email")
      .eq("id", frqUploadId.trim())
      .single();

    if (!upload || upload.status !== "ready") {
      return NextResponse.json({ error: "FRQ exam not found or not ready." }, { status: 404 });
    }

    const isOwner = normalizeEmail(upload.user_email as string) === email;
    let resolvedAssignmentId: string | null = null;
    let isLate = false;

    if (assignmentId?.trim()) {
      const access = await resolveFrqAssignmentAccess(supabase, {
        assignmentId: assignmentId.trim(),
        frqUploadId: frqUploadId.trim(),
        studentEmail: email,
      });
      if (!access.allowed) {
        return NextResponse.json({ error: "Assignment access denied." }, { status: 403 });
      }
      resolvedAssignmentId = assignmentId.trim();
      isLate = computeIsLate(new Date(), access.dueAt);
    } else if (!isOwner) {
      const allowed = await canAccessFrqUpload(supabase, frqUploadId.trim(), email);
      if (!allowed) {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    }

    const { data: questions } = await supabase
      .from("frq_questions")
      .select("id")
      .eq("frq_upload_id", frqUploadId.trim());

    if (!questions?.length) {
      return NextResponse.json({ error: "No questions found." }, { status: 400 });
    }

    const { data: attempt, error } = await supabase
      .from("frq_attempts")
      .insert({
        user_email: email,
        frq_upload_id: frqUploadId.trim(),
        max_score: upload.max_score,
        assignment_id: resolvedAssignmentId,
        is_late: isLate,
      })
      .select("id")
      .single();

    if (error) {
      console.error("frq start:", error);
      return NextResponse.json({ error: "Failed to start FRQ exam." }, { status: 500 });
    }

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err) {
    console.error("frq start error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start exam." },
      { status: 500 }
    );
  }
}
