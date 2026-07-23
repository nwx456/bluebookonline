import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { isInstitutionEmail } from "@/lib/institution-auth";
import { isModeratorEmail } from "@/lib/moderator-auth";
import { withTimeout } from "@/lib/promise-timeout";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";
import { isTeacherEmail } from "@/lib/teacher-auth";

const ROLE_LOOKUP_TIMEOUT_MS = 5000;

/** Post-login redirect: admin → /admin/mail, moderator → /moderator, institution → /institution, teacher → /teacher, else /dashboard */
export async function getPostLoginPath(email: string | null | undefined): Promise<string> {
  if (isAdminBroadcastEmail(email)) return "/admin/mail";
  if (
    await withTimeout(
      isModeratorEmail(email),
      false,
      "isModeratorEmail",
      ROLE_LOOKUP_TIMEOUT_MS
    )
  ) {
    return "/moderator";
  }
  if (
    await withTimeout(
      isInstitutionEmail(email),
      false,
      "isInstitutionEmail",
      ROLE_LOOKUP_TIMEOUT_MS
    )
  ) {
    return "/institution";
  }
  if (
    await withTimeout(
      isTeacherEmail(email),
      false,
      "isTeacherEmail",
      ROLE_LOOKUP_TIMEOUT_MS
    )
  ) {
    return "/teacher";
  }
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
