import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { buildErrorFingerprint } from "./fingerprint";
import type { RecordErrorInput } from "./types";

export async function recordError(input: RecordErrorInput): Promise<void> {
  try {
    const fingerprint = buildErrorFingerprint({
      source: input.source,
      errorName: input.errorName,
      message: input.message,
      pageUrl: input.pageUrl,
      endpoint: input.endpoint,
    });

    const supabase = createServerSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: existing, error: selectError } = await supabase
      .from("error_log_entries")
      .select("id, occurrence_count")
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (selectError) {
      console.error("error-logging/select:", selectError);
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("error_log_entries")
        .update({
          last_seen_at: now,
          occurrence_count: (existing.occurrence_count ?? 0) + 1,
          stack_trace: input.stackTrace ?? null,
          status_code: input.statusCode ?? null,
          user_email: input.userEmail ?? null,
          user_id: input.userId ?? null,
          last_metadata: input.metadata ?? {},
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("error-logging/update:", updateError);
      }
      return;
    }

    const { error: insertError } = await supabase.from("error_log_entries").insert({
      fingerprint,
      source: input.source,
      error_name: input.errorName,
      status_code: input.statusCode ?? null,
      message: input.message.slice(0, 2000),
      stack_trace: input.stackTrace ?? null,
      page_url: input.pageUrl ?? null,
      endpoint: input.endpoint ?? null,
      user_email: input.userEmail ?? null,
      user_id: input.userId ?? null,
      status: "open",
      occurrence_count: 1,
      first_seen_at: now,
      last_seen_at: now,
      last_metadata: input.metadata ?? {},
    });

    if (insertError) {
      console.error("error-logging/insert:", insertError);
    }
  } catch (err) {
    console.error("error-logging/record:", err);
  }
}
