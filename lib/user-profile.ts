import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATARS_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_SIGNED_URL_TTL_SECONDS = 3600;

const ALLOWED_AVATAR_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_AVATAR_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type UserProfileRow = {
  email: string;
  username: string | null;
  role: string;
  country_code: string | null;
  legal_region: string | null;
  created_at: string | null;
  avatar_storage_path: string | null;
};

export type UserProfileResponse = {
  username: string | null;
  email: string;
  role: string;
  countryCode: string | null;
  legalRegion: string | null;
  memberSince: string | null;
  avatarUrl: string | null;
};

export function normalizeUserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function avatarExtensionFromFilename(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return ALLOWED_AVATAR_EXTENSIONS.has(ext) ? ext : null;
}

export function avatarMimeForExtension(ext: string): string | null {
  return ALLOWED_AVATAR_MIME[ext] ?? null;
}

export function buildAvatarStoragePath(email: string, ext: string): string {
  const normalized = normalizeUserEmail(email);
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  return `${normalized}/avatar.${safeExt}`;
}

export function isAvatarStoragePathForUser(path: string, email: string): boolean {
  const normalized = normalizeUserEmail(email);
  return path.startsWith(`${normalized}/avatar.`);
}

export async function getSignedAvatarReadUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(storagePath, AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function mapProfileRow(
  row: UserProfileRow,
  avatarUrl: string | null
): UserProfileResponse {
  return {
    username: row.username,
    email: row.email,
    role: row.role,
    countryCode: row.country_code,
    legalRegion: row.legal_region,
    memberSince: row.created_at,
    avatarUrl,
  };
}

export async function removeAvatarFromStorage(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<void> {
  if (!storagePath) return;
  await supabase.storage.from(AVATARS_BUCKET).remove([storagePath]);
}
