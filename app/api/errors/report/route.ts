import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/admin-mail-auth";
import { recordError } from "@/lib/error-logging";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
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

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

type ReportBody = {
  message?: unknown;
  name?: unknown;
  stack?: unknown;
  pageUrl?: unknown;
  context?: unknown;
  digest?: unknown;
};

/**
 * POST /api/errors/report
 * Fire-and-forget client error reporting (auth optional).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (!checkRateLimit(ip)) {
      return new NextResponse(null, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as ReportBody;
    const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "Unknown error";
    const errorName = typeof body.name === "string" ? body.name.slice(0, 200) : "Error";
    const stackTrace = typeof body.stack === "string" ? body.stack.slice(0, 8000) : null;
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : null;
    const digest = typeof body.digest === "string" ? body.digest.slice(0, 200) : undefined;
    const context = typeof body.context === "string" ? body.context.slice(0, 500) : undefined;

    const { user } = await getAuthUser(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await recordError({
      source: "client",
      errorName,
      message,
      stackTrace,
      pageUrl,
      userEmail: user?.email ?? null,
      userId: user?.id ?? null,
      metadata: {
        ...(userAgent ? { userAgent } : {}),
        ...(digest ? { digest } : {}),
        ...(context ? { context } : {}),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("errors/report:", err);
    return new NextResponse(null, { status: 204 });
  }
}
