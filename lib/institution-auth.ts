import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import {
  getInstitutionByOwner,
  type InstitutionRow,
} from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function isInstitutionEmail(
  email: string | null | undefined
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("usertable")
    .select("role")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    console.error("isInstitutionEmail lookup error:", error);
    return false;
  }
  return data?.role === "INSTITUTION";
}

export type InstitutionAuthResult =
  | { user: User; institution: InstitutionRow; error: null; status: null }
  | { user: null; institution: null; error: string; status: 401 | 403 };

/** Bearer token + INSTITUTION role gate; returns institution row for the owner. */
export async function requireInstitutionUser(
  request: NextRequest
): Promise<InstitutionAuthResult> {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return {
      user: null,
      institution: null,
      error: authError ?? "Unauthorized.",
      status: 401,
    };
  }

  const isInstitution = await isInstitutionEmail(user.email);
  if (!isInstitution) {
    return {
      user: null,
      institution: null,
      error: "Forbidden.",
      status: 403,
    };
  }

  const supabase = createServerSupabaseAdmin();
  const institution = await getInstitutionByOwner(supabase, user.email);
  if (!institution) {
    return {
      user: null,
      institution: null,
      error: "Institution profile not found.",
      status: 403,
    };
  }

  if (institution.status === "suspended") {
    return {
      user: null,
      institution: null,
      error: "This institution account is suspended.",
      status: 403,
    };
  }

  return { user, institution, error: null, status: null };
}
