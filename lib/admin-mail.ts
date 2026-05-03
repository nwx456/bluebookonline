/** Single account that uses the admin mail tools UI and is redirected after login. */
export const ADMIN_BROADCAST_EMAIL = "info@apbluebookonline.com";

export function isAdminBroadcastEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === ADMIN_BROADCAST_EMAIL;
}
