import { createClient } from "@/lib/supabase/client";
import { parseUnknownError } from "@/lib/error-logging/parse-error";

export type ClientErrorReportOptions = {
  pageUrl?: string;
  context?: string;
  digest?: string;
};

function getPageUrl(override?: string): string {
  if (override) return override;
  if (typeof window !== "undefined") return window.location.href;
  return "";
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget client error report. Never throws.
 */
export function reportClientError(error: unknown, options: ClientErrorReportOptions = {}): void {
  const parsed = parseUnknownError(error);
  const pageUrl = getPageUrl(options.pageUrl);

  void (async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      await fetch("/api/errors/report", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: parsed.name,
          message: parsed.message,
          stack: parsed.stack,
          pageUrl,
          context: options.context,
          digest: options.digest,
        }),
        keepalive: true,
      });
    } catch {
      // best-effort
    }
  })();
}
