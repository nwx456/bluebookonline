import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { isModeratorEmail } from "@/lib/moderator-auth";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";
import { isTeacherEmail } from "@/lib/teacher-auth";

/** Post-login redirect: admin → /admin/mail, moderator → /moderator, teacher → /teacher, else /dashboard */
export async function getPostLoginPath(email: string | null | undefined): Promise<string> {
  if (isAdminBroadcastEmail(email)) return "/admin/mail";
  if (await isModeratorEmail(email)) return "/moderator";
  if (await isTeacherEmail(email)) return "/teacher";
  return "/dashboard";
}

/** Prefer validated `next` when present; otherwise fall back to role-based redirect. */
export async function resolvePostAuthPath(
  email: string | null | undefined,
  next?: string | null
): Promise<string> {
  const safe = sanitizeRedirectPath(next);
  if (safe) return safe;
  return getPostLoginPath(email);
}
