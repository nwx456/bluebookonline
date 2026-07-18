import { NextRequest, NextResponse } from "next/server";
import { requireModeratorUser } from "@/lib/moderator-auth";

/**
 * GET /api/moderator/me — Verify current user is an active moderator.
 */
export async function GET(request: NextRequest) {
  const auth = await requireModeratorUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error, isModerator: false }, { status: auth.status });
  }
  return NextResponse.json({
    isModerator: true,
    email: auth.user.email,
  });
}
