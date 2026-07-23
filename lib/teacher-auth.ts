import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export type UserRole = "STUDENT" | "TEACHER" | "INSTITUTION";

export async function getUserRole(
  email: string | null | undefined
): Promise<UserRole> {
  const normalized = normalizeEmail(email);
  if (!normalized) return "STUDENT";

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("usertable")
    .select("role")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("getUserRole lookup error:", error);
    return "STUDENT";
  }

  if (data?.role === "TEACHER") return "TEACHER";
  if (data?.role === "INSTITUTION") return "INSTITUTION";
  return "STUDENT";
}

export async function isTeacherEmail(
  email: string | null | undefined
): Promise<boolean> {
  return (await getUserRole(email)) === "TEACHER";
}

export type TeacherAuthResult =
  | { user: User; error: null; status: null }
  | { user: null; error: string; status: 401 | 403 };

/** Bearer token + TEACHER role gate for teacher API routes. */
export async function requireTeacherUser(
  request: NextRequest
): Promise<TeacherAuthResult> {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return { user: null, error: authError ?? "Unauthorized.", status: 401 };
  }
  const isTeacher = await isTeacherEmail(user.email);
  if (!isTeacher) {
    return { user: null, error: "Forbidden.", status: 403 };
  }
  return { user, error: null, status: null };
}
