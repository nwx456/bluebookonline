import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegalRegion } from "./countries";
import type { ConsentType } from "./policy-versions";
import { policyVersionFor } from "./policy-versions";

export function hashAuditValue(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return createHash("sha256").update(value.trim()).digest("hex");
}

export type RecordConsentInput = {
  userEmail: string;
  consentType: ConsentType;
  legalRegion: LegalRegion;
  granted: boolean;
  ip?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown>;
};

export async function recordConsent(
  supabase: SupabaseClient,
  input: RecordConsentInput
): Promise<{ error: string | null }> {
  const doc =
    input.consentType === "terms"
      ? "terms"
      : input.consentType === "privacy"
        ? "privacy"
        : input.consentType === "cookies_analytics"
          ? "cookies"
          : "privacy";

  const { error } = await supabase.from("user_consents").insert({
    user_email: input.userEmail.trim().toLowerCase(),
    consent_type: input.consentType,
    legal_region: input.legalRegion,
    policy_version: policyVersionFor(input.legalRegion, doc),
    granted: input.granted,
    revoked_at: input.granted ? null : new Date().toISOString(),
    ip_hash: hashAuditValue(input.ip),
    user_agent_hash: hashAuditValue(input.userAgent),
    context: input.context ?? null,
  });

  if (error) {
    console.error("recordConsent error:", error);
    return { error: error.message };
  }
  return { error: null };
}

export async function recordSignupConsents(
  supabase: SupabaseClient,
  opts: {
    userEmail: string;
    legalRegion: LegalRegion;
    marketingOptIn: boolean;
    ip?: string | null;
    userAgent?: string | null;
  }
): Promise<{ error: string | null }> {
  const base = {
    userEmail: opts.userEmail,
    legalRegion: opts.legalRegion,
    ip: opts.ip,
    userAgent: opts.userAgent,
  };

  for (const consentType of ["terms", "privacy"] as ConsentType[]) {
    const { error } = await recordConsent(supabase, { ...base, consentType, granted: true });
    if (error) return { error };
  }

  const { error: marketingError } = await recordConsent(supabase, {
    ...base,
    consentType: "marketing",
    granted: opts.marketingOptIn,
  });
  return { error: marketingError };
}

export async function hasActiveConsent(
  supabase: SupabaseClient,
  userEmail: string,
  consentType: ConsentType
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_consents")
    .select("granted, granted_at")
    .eq("user_email", userEmail.trim().toLowerCase())
    .eq("consent_type", consentType)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return data.granted === true;
}

export async function getLatestConsents(
  supabase: SupabaseClient,
  userEmail: string
): Promise<Record<ConsentType, boolean>> {
  const types: ConsentType[] = [
    "terms",
    "privacy",
    "marketing",
    "ai_processing",
    "public_publish",
    "copyright_attestation",
    "cookies_analytics",
  ];
  const result = {} as Record<ConsentType, boolean>;
  await Promise.all(
    types.map(async (t) => {
      result[t] = await hasActiveConsent(supabase, userEmail, t);
    })
  );
  return result;
}

/** Per-resource audit trail when a resource enters the moderator review queue. */
export async function recordResourcePublishConsent(
  supabase: SupabaseClient,
  opts: {
    userEmail: string;
    resourceId: string;
    ip?: string | null;
    userAgent?: string | null;
    source?: string;
  }
): Promise<{ error: string | null }> {
  const { data: profile } = await supabase
    .from("usertable")
    .select("legal_region")
    .eq("email", opts.userEmail.trim().toLowerCase())
    .maybeSingle();

  const legalRegion = (profile?.legal_region as LegalRegion) ?? "ROW";

  return recordConsent(supabase, {
    userEmail: opts.userEmail,
    consentType: "public_publish",
    legalRegion,
    granted: true,
    ip: opts.ip,
    userAgent: opts.userAgent,
    context: {
      resource_id: opts.resourceId,
      source: opts.source ?? "teacher_resource",
    },
  });
}

/** Per-upload audit trail when an exam enters the moderator review queue. */
export async function recordUploadPublishConsent(
  supabase: SupabaseClient,
  opts: {
    userEmail: string;
    uploadId: string;
    ip?: string | null;
    userAgent?: string | null;
    source?: string;
  }
): Promise<{ error: string | null }> {
  const { data: profile } = await supabase
    .from("usertable")
    .select("legal_region")
    .eq("email", opts.userEmail.trim().toLowerCase())
    .maybeSingle();

  const legalRegion = (profile?.legal_region as LegalRegion) ?? "ROW";

  return recordConsent(supabase, {
    userEmail: opts.userEmail,
    consentType: "public_publish",
    legalRegion,
    granted: true,
    ip: opts.ip,
    userAgent: opts.userAgent,
    context: {
      upload_id: opts.uploadId,
      source: opts.source ?? "upload_analyze",
    },
  });
}
