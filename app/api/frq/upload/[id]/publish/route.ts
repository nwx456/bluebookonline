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
      .from("frq_uploads")
      .select("id, user_email, is_published, moderation_status, status")
      .eq("id", uploadId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "FRQ exam not found." }, { status: 404 });
    }

    if ((upload.user_email as string)?.trim().toLowerCase() !== userEmail) {
      return NextResponse.json(
        { error: "You can only publish your own exams." },
        { status: 403 }
      );
    }

    if (upload.status !== "ready") {
      return NextResponse.json(
        { error: "Only analyzed FRQ exams can be published." },
        { status: 400 }
      );
    }

    const currentStatus = (upload.moderation_status as ModerationStatus) ?? "draft";
    const currentlyPublished =
      upload.is_published === true && currentStatus === "approved";

    if (isPublished) {
      if (currentStatus === "pending_review") {
        return NextResponse.json({
          success: true,
          moderationStatus: "pending_review",
          isPublished: false,
          message: "Already awaiting moderator approval.",
        });
      }

      if (currentlyPublished) {
        return NextResponse.json({
          success: true,
          moderationStatus: "approved",
          isPublished: true,
          message: "Already published.",
        });
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
        source: "frq_publish_resubmit",
      });

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("frq_uploads")
        .update({
          is_published: false,
          moderation_status: "pending_review",
          publish_requested_at: now,
        })
        .eq("id", uploadId);

      if (updateError) {
        console.error("frq_uploads publish request error:", updateError);
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

    const { error: updateError } = await supabase
      .from("frq_uploads")
      .update({
        is_published: false,
        moderation_status: "draft",
      })
      .eq("id", uploadId);

    if (updateError) {
      console.error("frq_uploads unpublish update error:", updateError);
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
    console.error("FRQ publish toggle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
