import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token)
    return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    return {
      user: null,
      error: "Invalid or expired session. Please sign in again.",
    };
  return { user, error: null };
}

export type AdminAuthResult =
  | { user: User; error: null; status: null }
  | { user: null; error: string; status: 401 | 403 };

/** Bearer token + admin broadcast email gate for admin API routes. */
export async function requireAdminUser(request: NextRequest): Promise<AdminAuthResult> {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return { user: null, error: authError ?? "Unauthorized.", status: 401 };
  }
  if (!isAdminBroadcastEmail(user.email)) {
    return { user: null, error: "Forbidden.", status: 403 };
  }
  return { user, error: null, status: null };
}
