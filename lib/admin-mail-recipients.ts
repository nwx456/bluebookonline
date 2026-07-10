import type { SupabaseClient } from "@supabase/supabase-js";

export type MailRecipientRow = { email: string; username: string | null };

/** Keeps `.in("email", …)` filter sizes reasonable for long query strings. */
const EMAIL_IN_CHUNK = 100;
const PAGE_SIZE = 1000;

/**
 * All registered users from usertable (paginated past PostgREST row limits).
 */
export async function fetchAllRegisteredRecipients(
  supabase: SupabaseClient
): Promise<MailRecipientRow[]> {
  const rows: MailRecipientRow[] = [];
  let from = 0;

  for (;;) {
    const { data: page, error } = await supabase
      .from("usertable")
      .select("email, username")
      .order("email", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!page?.length) break;

    for (const r of page) {
      const email = String(r.email ?? "").trim().toLowerCase();
      if (!email) continue;
      rows.push({
        email,
        username: (r.username as string | null) ?? null,
      });
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * Resolve selected emails against usertable in chunks (avoids PostgREST `.in()` URL limits).
 */
export async function lookupRecipientsByEmail(
  supabase: SupabaseClient,
  normalizedEmails: string[]
): Promise<{ rows: MailRecipientRow[]; skipped: number }> {
  const unique = [...new Set(normalizedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) {
    return { rows: [], skipped: 0 };
  }

  const found = new Map<string, MailRecipientRow>();

  for (let i = 0; i < unique.length; i += EMAIL_IN_CHUNK) {
    const chunk = unique.slice(i, i + EMAIL_IN_CHUNK);
    const { data, error } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", chunk);

    if (error) throw error;

    for (const r of data ?? []) {
      const email = String(r.email).trim().toLowerCase();
      if (!email) continue;
      found.set(email, {
        email,
        username: (r.username as string | null) ?? null,
      });
    }
  }

  const rows = unique.filter((e) => found.has(e)).map((e) => found.get(e)!);
  const skipped = unique.length - rows.length;
  return { rows, skipped };
}
