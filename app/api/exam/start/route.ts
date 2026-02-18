import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const uploadId = (body.uploadId ?? body.upload_id) as string | undefined;
    const userEmail = (body.userEmail ?? body.user_email) as string | undefined;

    if (!uploadId?.trim() || !userEmail?.trim()) {
      return NextResponse.json(
        { error: "uploadId and userEmail are required." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: upload, error: uploadError } = await supabase
      .from("pdf_uploads")
      .select("user_email, is_published")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Exam not found." },
        { status: 404 }
      );
    }

    const ownerEmail = (upload.user_email as string)?.trim().toLowerCase();
    const isPublished = upload.is_published === true;
    const requestingEmail = userEmail.trim().toLowerCase();
    const isOwner = ownerEmail === requestingEmail;

    if (!isOwner && !isPublished) {
      return NextResponse.json(
        { error: "This exam is not published. Only the owner can start it." },
        { status: 403 }
      );
    }

    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("upload_id", uploadId)
      .order("question_number", { ascending: true });

    const totalQuestions = questions?.length ?? 0;
    if (totalQuestions === 0) {
      return NextResponse.json(
        { error: "No questions found for this exam." },
        { status: 400 }
      );
    }

    const { data: attempt, error } = await supabase
      .from("attempts")
      .insert({
        user_email: userEmail.trim(),
        upload_id: uploadId,
        total_questions: totalQuestions,
      })
      .select("id")
      .single();

    if (error) {
      console.error("exam start insert error:", error);
      return NextResponse.json(
        { error: "Failed to start exam." },
        { status: 500 }
      );
    }

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err) {
    console.error("exam start error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start exam." },
      { status: 500 }
    );
  }
}
