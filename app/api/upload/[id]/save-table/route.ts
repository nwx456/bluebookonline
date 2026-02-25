import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const GRAPHS_BUCKET = "exam-graphs";
const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    return { user: null, error: "Invalid or expired session. Please sign in again." };
  return { user, error: null };
}

/**
 * POST /api/upload/[id]/save-table – Save table image to Storage and update question.image_url.
 * Auth: owner or is_published.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: uploadId } = await params;
    if (!uploadId?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    const userEmail = user!.email!.trim().toLowerCase();

    const body = await request.json().catch(() => ({}));
    const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : "";
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";

    if (!questionId || !imageBase64.startsWith("data:image/png;base64,")) {
      return NextResponse.json(
        { error: "questionId and imageBase64 (data:image/png;base64,...) are required." },
        { status: 400 }
      );
    }

    const base64Data = imageBase64.replace(/^data:image\/png;base64,/, "");
    if (base64Data.length * 0.75 > MAX_BASE64_SIZE) {
      return NextResponse.json({ error: "Image too large." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, user_email, is_published")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const uploadOwner = (upload.user_email as string)?.trim().toLowerCase();
    const isPublished = upload.is_published === true;
    const isOwner = uploadOwner === userEmail;
    if (!isOwner && !isPublished) {
      return NextResponse.json(
        { error: "You can only save tables for your own exams or published exams." },
        { status: 403 }
      );
    }

    const { data: question, error: qError } = await supabase
      .from("questions")
      .select("id, upload_id")
      .eq("id", questionId)
      .eq("upload_id", uploadId)
      .maybeSingle();

    if (qError || !question) {
      return NextResponse.json({ error: "Question not found or not part of this exam." }, { status: 404 });
    }

    const buffer = Buffer.from(base64Data, "base64");
    const storagePath = `${uploadId}/${questionId}.png`;

    const { error: uploadError } = await supabase.storage
      .from(GRAPHS_BUCKET)
      .upload(storagePath, buffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Table upload error:", uploadError);
      return NextResponse.json(
        { error: "Could not save table image. Please try again." },
        { status: 500 }
      );
    }

    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
    const imageUrl = `${projectUrl}/storage/v1/object/public/${GRAPHS_BUCKET}/${storagePath}`;

    const { error: updateError } = await supabase
      .from("questions")
      .update({ image_url: imageUrl })
      .eq("id", questionId)
      .eq("upload_id", uploadId);

    if (updateError) {
      console.error("Question image_url update error:", updateError);
      return NextResponse.json(
        { error: "Table saved but failed to update question. Please refresh." },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Save table error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed." },
      { status: 500 }
    );
  }
}
