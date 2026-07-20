import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/admin/recent-signups
 * Registered users from usertable, newest first.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

    const supabase = createServerSupabaseAdmin();
    const { data: rows, error, count } = await supabase
      .from("usertable")
      .select("email, username, role, country_code, legal_region, marketing_opt_in, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("admin/recent-signups:", error);
      return NextResponse.json({ error: "Could not load recent signups." }, { status: 500 });
    }

    return NextResponse.json({
      items: (rows ?? []).map((row) => ({
        email: String(row.email ?? ""),
        username: (row.username as string | null) ?? "",
        role: (row.role as string | null) ?? "STUDENT",
        countryCode: (row.country_code as string | null) ?? null,
        legalRegion: (row.legal_region as string | null) ?? null,
        marketingOptIn: row.marketing_opt_in === true,
        createdAt: String(row.created_at ?? ""),
      })),
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    console.error("admin/recent-signups:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
