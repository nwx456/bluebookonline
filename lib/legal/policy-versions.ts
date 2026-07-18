import type { LegalRegion } from "./countries";

export const POLICY_VERSION = "v2.1";

export type ConsentType =
  | "terms"
  | "privacy"
  | "marketing"
  | "ai_processing"
  | "public_publish"
  | "copyright_attestation"
  | "cookies_analytics";

export function policyVersionFor(region: LegalRegion, doc: "privacy" | "terms" | "cookies"): string {
  return `${doc}-${POLICY_VERSION}-${region}`;
}

export const CONSENT_LABELS: Record<ConsentType, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  marketing: "Marketing emails",
  ai_processing: "AI processing of uploaded PDFs",
  public_publish: "Publishing exams publicly",
  copyright_attestation: "Copyright attestation for uploads",
  cookies_analytics: "Analytics and advertising cookies",
};
