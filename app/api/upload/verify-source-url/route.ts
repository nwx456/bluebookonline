import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { verifyExamSourceUrl } from "@/lib/exam-source-url-verify";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

async function getAuthUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return { user: null, error: "Invalid or expired session. Please sign in again." };
  }
  return { user, error: null };
}

/**
 * POST /api/upload/verify-source-url
 * Checks that a book/agency source URL is reachable (SSRF-safe HEAD/GET).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: authError }, { status: 401 });
    }

    const rateKey = user.email!.trim().toLowerCase();
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { ok: false, error: "Too many link checks. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => null)) as { sourceUrl?: unknown } | null;
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl : "";
    if (!sourceUrl.trim()) {
      return NextResponse.json(
        { ok: false, error: "A source URL is required for books and agencies." },
        { status: 200 }
      );
    }

    const result = await verifyExamSourceUrl(sourceUrl);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("verify-source-url:", err);
    return NextResponse.json(
      { ok: false, error: "Could not verify source URL. Please try again." },
      { status: 500 }
    );
  }
}
