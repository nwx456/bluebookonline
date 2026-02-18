import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

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
 * PATCH /api/upload/[id]/publish – Toggle is_published for an upload.
 * Only the owner (user_email matches authenticated user) can toggle.
 */
export async function PATCH(
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
    const isPublished = body.isPublished === true;

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, user_email")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    }

    const uploadOwner = (upload.user_email as string)?.trim().toLowerCase();
    if (uploadOwner !== userEmail) {
      return NextResponse.json(
        { error: "You can only publish your own exams." },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from("pdf_uploads")
      .update({ is_published: isPublished })
      .eq("id", uploadId);

    if (updateError) {
      console.error("pdf_uploads publish update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update publish status. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, isPublished });
  } catch (err) {
    console.error("Publish toggle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
