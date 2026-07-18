import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const secret =
    (process.env.PENDING_REG_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret) {
    throw new Error("PENDING_REG_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptPendingPassword(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPendingPassword(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = getKey();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/** Backward-compatible: legacy rows stored plaintext in password_hash. */
export function resolvePendingPassword(row: {
  password_hash?: string | null;
  password_encrypted?: string | null;
}): string | null {
  if (row.password_encrypted) {
    return decryptPendingPassword(row.password_encrypted);
  }
  return row.password_hash ?? null;
}
