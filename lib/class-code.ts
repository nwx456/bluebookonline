import { randomInt } from "node:crypto";

/** Excludes ambiguous characters (0/O, 1/I/L). */
const CLASS_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CLASS_CODE_LENGTH = 8;

/** Generate a random class join code (uppercase alphanumeric). */
export function generateClassCode(length = CLASS_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CLASS_CODE_CHARSET[randomInt(0, CLASS_CODE_CHARSET.length)]!;
  }
  return code;
}

/** Validate user-supplied class code format (normalized uppercase). */
export function normalizeClassCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, "");
}

export function isValidClassCodeFormat(code: string): boolean {
  if (code.length !== CLASS_CODE_LENGTH) return false;
  return /^[A-Z0-9]+$/.test(code);
}
