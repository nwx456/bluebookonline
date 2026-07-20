import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { ErrorLogEntry, ErrorLogSource, ErrorLogStatus } from "@/lib/error-logging";

function parseIntParam(value: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function rowToEntry(row: Record<string, unknown>): ErrorLogEntry {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    source: row.source as ErrorLogSource,
    error_name: String(row.error_name),
    status_code: typeof row.status_code === "number" ? row.status_code : null,
    message: String(row.message ?? ""),
    stack_trace: typeof row.stack_trace === "string" ? row.stack_trace : null,
    page_url: typeof row.page_url === "string" ? row.page_url : null,
    endpoint: typeof row.endpoint === "string" ? row.endpoint : null,
    user_email: typeof row.user_email === "string" ? row.user_email : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    status: row.status as ErrorLogStatus,
    occurrence_count: typeof row.occurrence_count === "number" ? row.occurrence_count : 1,
    first_seen_at: String(row.first_seen_at),
    last_seen_at: String(row.last_seen_at),
    last_metadata:
      row.last_metadata && typeof row.last_metadata === "object"
        ? (row.last_metadata as Record<string, unknown>)
        : {},
  };
}

/**
 * GET /api/admin/error-logs
 * List deduplicated error log entries (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userEmail = searchParams.get("userEmail");
    const errorName = searchParams.get("errorName");
    const source = searchParams.get("source");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseIntParam(searchParams.get("page"), 1, 10_000);
    const limit = parseIntParam(searchParams.get("limit"), 50, 100);
    const offset = (page - 1) * limit;

    const supabase = createServerSupabaseAdmin();
    let query = supabase
      .from("error_log_entries")
      .select("*", { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["open", "investigating", "resolved"].includes(status)) {
      query = query.eq("status", status);
    }
    if (userEmail?.trim()) {
      query = query.ilike("user_email", `%${userEmail.trim()}%`);
    }
    if (errorName?.trim()) {
      query = query.ilike("error_name", `%${errorName.trim()}%`);
    }
    if (source === "client" || source === "server") {
      query = query.eq("source", source);
    }
    if (from) {
      query = query.gte("last_seen_at", from);
    }
    if (to) {
      query = query.lte("last_seen_at", to);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("admin/error-logs GET:", error);
      return NextResponse.json({ error: "Could not load error logs." }, { status: 500 });
    }

    const entries = (data ?? []).map((row) => rowToEntry(row as Record<string, unknown>));
    return NextResponse.json({
      entries,
      total: count ?? entries.length,
      page,
      limit,
    });
  } catch (e) {
    console.error("admin/error-logs GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
