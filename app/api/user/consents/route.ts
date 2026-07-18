import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getClientIp } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { getLatestConsents, recordConsent } from "@/lib/legal/consent";
import type { ConsentType } from "@/lib/legal/policy-versions";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseAdmin();
  const email = user.email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("usertable")
    .select("country_code, legal_region, marketing_opt_in, age_confirmed_13_plus, created_at")
    .eq("email", email)
    .maybeSingle();

  const consents = await getLatestConsents(supabase, email);

  return NextResponse.json({
    profile: profile ?? null,
    consents,
  });
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const consentType = body.consentType as ConsentType | undefined;
  const granted = body.granted === true;

  if (!consentType || !["marketing", "cookies_analytics"].includes(consentType)) {
    return NextResponse.json(
      { error: "Only marketing or cookies_analytics consent can be updated here." },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseAdmin();
  const email = user.email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("usertable")
    .select("legal_region")
    .eq("email", email)
    .maybeSingle();

  const legalRegion = (profile?.legal_region as string) ?? "ROW";

  const { error } = await recordConsent(supabase, {
    userEmail: email,
    consentType,
    legalRegion: legalRegion as "EU" | "TR" | "US" | "MENA" | "ROW",
    granted,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  if (error) {
    return NextResponse.json({ error: "Could not update consent." }, { status: 500 });
  }

  if (consentType === "marketing") {
    await supabase.from("usertable").update({ marketing_opt_in: granted }).eq("email", email);
  }

  return NextResponse.json({ success: true, consentType, granted });
}
