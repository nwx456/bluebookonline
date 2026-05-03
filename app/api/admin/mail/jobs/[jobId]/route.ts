import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { getAuthUser } from "@/lib/admin-mail-auth";

/**
 * GET /api/admin/mail/jobs/[jobId]
 * Status for async broadcast jobs (admin only).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }
    if (!isAdminBroadcastEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { jobId } = await context.params;
    if (!jobId?.trim()) {
      return NextResponse.json({ error: "Invalid job id." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: job, error } = await supabase
      .from("outbound_email_jobs")
      .select(
        "id, status, created_at, updated_at, admin_email, subject, cursor_index, total_recipients, sent, failed, skipped, first_error, processed_at"
      )
      .eq("id", jobId.trim())
      .maybeSingle();

    if (error) {
      console.error("admin/mail/jobs get:", error);
      return NextResponse.json({ error: "Could not load job." }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (e) {
    console.error("admin/mail/jobs:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
