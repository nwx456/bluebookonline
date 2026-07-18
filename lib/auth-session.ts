import { NextRequest } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function getAuthUser(
  request: NextRequest
): Promise<{ user: User | null; error: string | null }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { user: null, error: "Authentication required. Please sign in again." };
  }
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

export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
