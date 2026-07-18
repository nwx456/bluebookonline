import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/admin-mail-auth";
import { getPostLoginPath } from "@/lib/post-login-redirect";

/**
 * GET /api/auth/redirect-path — Post-login redirect for current session.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error || !user?.email) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
  }
  const path = await getPostLoginPath(user.email);
  return NextResponse.json({ path });
}
