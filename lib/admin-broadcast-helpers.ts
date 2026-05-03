export const ADMIN_BROADCAST_SEND_GAP_MS = 550;

export function displayNameForRow(
  email: string,
  username: string | null | undefined
): string {
  const u = username?.trim();
  if (u) return u;
  const local = email.split("@")[0];
  return local || email;
}
