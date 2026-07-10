import { NextRequest, NextResponse } from "next/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { createSignedPdfUrl, PDF_BUCKET } from "@/lib/signed-pdf-url";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const GRAPHS_BUCKET = "exam-graphs";

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
 * GET /api/upload/[id] – Return a signed URL for the exam PDF (owner only).
 * Used by Macro/Micro exam page to render the PDF page image.
 */
export async function GET(
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

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, user_email, storage_path, is_published")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const uploadOwner = (upload.user_email as string)?.trim().toLowerCase();
    const isPublished = upload.is_published === true;
    const isOwner = uploadOwner === userEmail;
    const isAdmin = isAdminBroadcastEmail(userEmail);
    if (!isOwner && !isPublished && !isAdmin) {
      return NextResponse.json(
        { error: "You can only access your own exams or published exams." },
        { status: 403 }
      );
    }

    const storagePath = upload.storage_path as string | null;
    const { url, error: signErr } = await createSignedPdfUrl(supabase, uploadId, storagePath);
    if (signErr || !url) {
      return NextResponse.json(
        { error: signErr ?? "Could not generate PDF link. Please try again." },
        { status: signErr?.includes("not available") ? 404 : 500 }
      );
    }

    return NextResponse.json({ url: url });
  } catch (err) {
    console.error("Upload PDF URL error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload/[id] – Delete an exam (pdf_upload + questions + attempts + attempt_answers).
 * Only the owner (user_email matches authenticated user) can delete.
 * Order: attempt_answers -> attempts -> questions -> pdf_uploads (and optional storage file).
 */
export async function DELETE(
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

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, user_email, storage_path")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: "Exam not found." },
        { status: 404 }
      );
    }

    const uploadOwner = (upload.user_email as string)?.trim().toLowerCase();
    if (uploadOwner !== userEmail) {
      return NextResponse.json(
        { error: "You can only delete your own exams." },
        { status: 403 }
      );
    }

    // 1. Get attempt ids for this upload
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id")
      .eq("upload_id", uploadId);
    const attemptIds = (attempts ?? []).map((a) => a.id);

    // 2. Delete attempt_answers for those attempts
    if (attemptIds.length > 0) {
      await supabase.from("attempt_answers").delete().in("attempt_id", attemptIds);
    }

    // 3. Delete attempts
    await supabase.from("attempts").delete().eq("upload_id", uploadId);

    // 4. Delete questions
    await supabase.from("questions").delete().eq("upload_id", uploadId);

    // 5. Optional: remove PDF from storage if we stored it (exam-pdfs bucket, key = storage_path)
    const storagePath = upload.storage_path as string | null;
    if (storagePath && storagePath.endsWith(".pdf")) {
      try {
        await supabase.storage.from(PDF_BUCKET).remove([storagePath]);
      } catch {
        // ignore storage errors; record is still deleted
      }
    }

    // 5b. Remove graph images for this upload (exam-graphs/{uploadId}/*)
    try {
      const { data: files } = await supabase.storage
        .from(GRAPHS_BUCKET)
        .list(uploadId);
      if (files?.length) {
        const paths = files.map((f) => `${uploadId}/${f.name}`);
        await supabase.storage.from(GRAPHS_BUCKET).remove(paths);
      }
    } catch {
      // ignore
    }

    // 6. Delete pdf_uploads row
    const { error: deleteError } = await supabase
      .from("pdf_uploads")
      .delete()
      .eq("id", uploadId);

    if (deleteError) {
      console.error("pdf_uploads delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete exam. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Upload delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 500 }
    );
  }
}
