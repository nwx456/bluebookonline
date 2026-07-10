import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { getAuthUser } from "@/lib/admin-mail-auth";
import {
  getMailWorkerBaseUrl,
  isMailWorkerKickConfigured,
} from "@/lib/admin-mail-worker-auth";
import { getMailConfigError, resolveMailProvider } from "@/lib/mail/from-address";

/**
 * GET /api/admin/mail/config
 * Mail provider + worker readiness for the admin UI.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }
    if (!isAdminBroadcastEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const mailError = getMailConfigError();
    let provider: string | null = null;
    if (!mailError) {
      try {
        provider = resolveMailProvider();
      } catch {
        provider = null;
      }
    }

    const supabase = createServerSupabaseAdmin();
    const { error: jobsTableErr } = await supabase
      .from("outbound_email_jobs")
      .select("id")
      .limit(1);

    return NextResponse.json({
      mailConfigured: !mailError,
      mailError,
      provider,
      workerKickConfigured: isMailWorkerKickConfigured(),
      workerBaseUrl: getMailWorkerBaseUrl() || null,
      mailOpsTablesReady: !jobsTableErr,
      mailOpsTablesError: jobsTableErr?.message ?? null,
    });
  } catch (e) {
    console.error("admin/mail/config:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
