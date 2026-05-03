import { createServerSupabaseAdmin } from "@/lib/supabase/server";

function capEnv(name: string): number {
  const v = (process.env[name] ?? "").trim();
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Returns an error message if the send would exceed caps; null if OK.
 * Caps of 0 mean disabled (unlimited).
 * Only counts rows in admin_mail_log with is_test = false.
 */
export async function checkAdminMailRateLimits(
  requestedRecipientCount: number
): Promise<string | null> {
  const dailyCap = capEnv("ADMIN_MAIL_DAILY_RECIPIENT_CAP");
  const hourlyCap = capEnv("ADMIN_MAIL_HOURLY_RECIPIENT_CAP");
  if (dailyCap === 0 && hourlyCap === 0) return null;

  const supabase = createServerSupabaseAdmin();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  if (dailyCap > 0) {
    const { data: rows, error } = await supabase
      .from("admin_mail_log")
      .select("recipient_count")
      .eq("is_test", false)
      .gte("created_at", dayAgo);
    if (error) {
      console.error("checkAdminMailRateLimits daily:", error);
      return "Could not verify send limits. Try again later.";
    }
    const used =
      (rows ?? []).reduce((s, r) => s + (Number(r.recipient_count) || 0), 0) ?? 0;
    if (used + requestedRecipientCount > dailyCap) {
      return `Daily recipient limit exceeded (${used}/${dailyCap} used in the last 24h).`;
    }
  }

  if (hourlyCap > 0) {
    const { data: rows, error } = await supabase
      .from("admin_mail_log")
      .select("recipient_count")
      .eq("is_test", false)
      .gte("created_at", hourAgo);
    if (error) {
      console.error("checkAdminMailRateLimits hourly:", error);
      return "Could not verify send limits. Try again later.";
    }
    const used =
      (rows ?? []).reduce((s, r) => s + (Number(r.recipient_count) || 0), 0) ?? 0;
    if (used + requestedRecipientCount > hourlyCap) {
      return `Hourly recipient limit exceeded (${used}/${hourlyCap} used in the last hour).`;
    }
  }

  return null;
}

export function getJobThreshold(): number {
  const v = (process.env.ADMIN_MAIL_JOB_THRESHOLD ?? "50").trim();
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function getWorkerBatchSize(): number {
  const v = (process.env.MAIL_WORKER_BATCH_SIZE ?? "25").trim();
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 25;
}
