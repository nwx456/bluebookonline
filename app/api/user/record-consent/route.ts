import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getClientIp } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { recordConsent } from "@/lib/legal/consent";
import type { ConsentType } from "@/lib/legal/policy-versions";

const ALLOWED_TYPES: ConsentType[] = [
  "ai_processing",
  "copyright_attestation",
  "public_publish",
];

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const consentType = body.consentType as ConsentType | undefined;
  const granted = body.granted !== false;
  const context = typeof body.context === "object" && body.context ? body.context : undefined;

  if (!consentType || !ALLOWED_TYPES.includes(consentType)) {
    return NextResponse.json({ error: "Invalid consent type." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const email = user.email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("usertable")
    .select("legal_region")
    .eq("email", email)
    .maybeSingle();

  const legalRegion = (profile?.legal_region as "EU" | "TR" | "US" | "MENA" | "ROW") ?? "ROW";

  const { error } = await recordConsent(supabase, {
    userEmail: email,
    consentType,
    legalRegion,
    granted,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    context,
  });

  if (error) {
    return NextResponse.json({ error: "Could not record consent." }, { status: 500 });
  }

  return NextResponse.json({ success: true, consentType, granted });
}
