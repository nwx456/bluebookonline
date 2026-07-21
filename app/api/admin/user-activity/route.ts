import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminUserActivity,
  isValidAdminUserActivityEmail,
} from "@/lib/admin-user-activity";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

function parseIntParam(value: string | null, fallback: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/**
 * GET /api/admin/user-activity?email=user@example.com&attemptsLimit=50&attemptsOffset=0
 * Admin-only aggregated user activity profile.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const email = normalizeEmail(searchParams.get("email"));
    if (!email) {
      return NextResponse.json({ error: "email query parameter is required." }, { status: 400 });
    }
    if (!isValidAdminUserActivityEmail(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const attemptsLimit = parseIntParam(searchParams.get("attemptsLimit"), 50, 100);
    const attemptsOffset = parseIntParam(searchParams.get("attemptsOffset"), 0, 10_000);

    const supabase = createServerSupabaseAdmin();
    const payload = await buildAdminUserActivity(supabase, email, {
      attemptsLimit,
      attemptsOffset,
    });

    if (!payload) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("admin/user-activity GET:", e);
    const message = e instanceof Error ? e.message : "Server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
