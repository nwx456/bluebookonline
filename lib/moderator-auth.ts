import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { getAuthUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export type ModerationStatus = "draft" | "pending_review" | "approved" | "rejected";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Check if email is an active moderator or the admin broadcast account. */
export async function isModeratorEmail(
  email: string | null | undefined
): Promise<boolean> {
  if (isAdminBroadcastEmail(email)) return true;

  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("moderators")
    .select("email")
    .eq("email", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("isModeratorEmail lookup error:", error);
    return false;
  }
  return Boolean(data?.email);
}

export type ModeratorAuthResult =
  | { user: User; error: null; status: null }
  | { user: null; error: string; status: 401 | 403 };

/** Bearer token + active moderator gate for moderator API routes. */
export async function requireModeratorUser(
  request: NextRequest
): Promise<ModeratorAuthResult> {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return { user: null, error: authError ?? "Unauthorized.", status: 401 };
  }
  const isMod = await isModeratorEmail(user.email);
  if (!isMod) {
    return { user: null, error: "Forbidden.", status: 403 };
  }
  return { user, error: null, status: null };
}

/** Public exams must be both published and approved by a moderator. */
export function isPubliclyVisibleExam(row: {
  is_published?: boolean | null;
  moderation_status?: string | null;
}): boolean {
  return (
    row.is_published === true &&
    (row.moderation_status === "approved" || row.moderation_status == null)
  );
}
