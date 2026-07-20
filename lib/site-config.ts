export const SITE_NAME = "AP Practice Exam Online";
export const SITE_META_DESCRIPTION =
  "Practice AP exams online with real Bluebook-style questions. Instant AI scoring for AP CSA, CSP, Calculus, Economics & more. Free for students worldwide.";
export const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.apracticexamonline.com";
export const CONTACT_EMAIL = "info@apracticexamonline.com";
export const COPYRIGHT_EMAIL = "copyright@apracticexamonline.com";
export const ADMIN_BROADCAST_EMAIL = CONTACT_EMAIL;
export const SITE_TITLE_SUFFIX = SITE_NAME;
export const DATA_EXPORT_PREFIX = "ap-practice-exam-online";

export function getSiteUrl(): string {
  return SITE_URL.replace(/\/$/, "");
}
