import { ADMIN_BROADCAST_EMAIL } from "@/lib/site-config";

export { ADMIN_BROADCAST_EMAIL };

export function isAdminBroadcastEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === ADMIN_BROADCAST_EMAIL;
}
