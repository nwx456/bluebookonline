import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { hasActiveConsent, recordUploadPublishConsent } from "@/lib/legal/consent";
import type { ModerationStatus } from "@/lib/moderator-auth";

async function getAuthUserFromRequest(request: NextRequest) {
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
 * PATCH /api/upload/[id]/publish – Resubmit for review or unpublish an upload.
 * Initial review queue entry happens at upload/analyze; this endpoint handles resubmits.
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

    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }
    const userEmail = user!.email!.trim().toLowerCase();

    const body = await request.json().catch(() => ({}));
    const isPublished = body.isPublished === true;

    const supabase = createServerSupabaseAdmin();
    const { data: upload, error: fetchError } = await supabase
      .from("pdf_uploads")
      .select("id, user_email, is_published, moderation_status")
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

    const currentStatus = (upload.moderation_status as ModerationStatus) ?? "draft";
    const currentlyPublished =
      upload.is_published === true && currentStatus === "approved";

    if (isPublished) {
      if (currentStatus === "pending_review") {
        return NextResponse.json(
          {
            success: true,
            moderationStatus: "pending_review",
            isPublished: false,
            message: "Already awaiting moderator approval.",
          },
          { status: 200 }
        );
      }

      if (currentlyPublished) {
        return NextResponse.json(
          {
            success: true,
            moderationStatus: "approved",
            isPublished: true,
            message: "Already published.",
          },
          { status: 200 }
        );
      }

      const hasPublishConsent = await hasActiveConsent(supabase, userEmail, "public_publish");
      if (!hasPublishConsent) {
        return NextResponse.json(
          { error: "Public publish consent is required.", code: "CONSENT_REQUIRED" },
          { status: 400 }
        );
      }

      await recordUploadPublishConsent(supabase, {
        userEmail,
        uploadId,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        source: "publish_resubmit",
      });

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("pdf_uploads")
        .update({
          is_published: false,
          moderation_status: "pending_review",
          publish_requested_at: now,
        })
        .eq("id", uploadId);

      if (updateError) {
        console.error("pdf_uploads publish request error:", updateError);
        return NextResponse.json(
          { error: "Failed to submit for review. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        moderationStatus: "pending_review",
        isPublished: false,
      });
    }

    // Unpublish
    const { error: updateError } = await supabase
      .from("pdf_uploads")
      .update({
        is_published: false,
        moderation_status: "draft",
      })
      .eq("id", uploadId);

    if (updateError) {
      console.error("pdf_uploads unpublish update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update publish status. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      moderationStatus: "draft",
      isPublished: false,
    });
  } catch (err) {
    console.error("Publish toggle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
