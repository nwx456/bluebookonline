import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { ErrorLogEntry, ErrorLogSource, ErrorLogStatus } from "@/lib/error-logging";

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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/error-logs/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("error_log_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("admin/error-logs/[id] GET:", error);
      return NextResponse.json({ error: "Could not load error log." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ entry: rowToEntry(data as Record<string, unknown>) });
  } catch (e) {
    console.error("admin/error-logs/[id] GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/error-logs/[id]
 * Body: { status: 'open' | 'investigating' | 'resolved' }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const status = body?.status;
    if (status !== "open" && status !== "investigating" && status !== "resolved") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const { id } = await context.params;
    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("error_log_entries")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("admin/error-logs/[id] PATCH:", error);
      return NextResponse.json({ error: "Could not update error log." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json({ entry: rowToEntry(data as Record<string, unknown>) });
  } catch (e) {
    console.error("admin/error-logs/[id] PATCH:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
