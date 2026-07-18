import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  getSignedAvatarReadUrl,
  mapProfileRow,
  normalizeUserEmail,
} from "@/lib/user-profile";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const email = normalizeUserEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const profileSelectWithAvatar =
    "username, email, role, country_code, legal_region, created_at, avatar_storage_path";
  const profileSelectBase =
    "username, email, role, country_code, legal_region, created_at";

  let profile:
    | {
        username: string | null;
        email: string;
        role: string;
        country_code: string | null;
        legal_region: string | null;
        created_at: string | null;
        avatar_storage_path?: string | null;
      }
    | null = null;
  let avatarStoragePath: string | null = null;

  const { data: profileWithAvatar, error: profileError } = await supabase
    .from("usertable")
    .select(profileSelectWithAvatar)
    .eq("email", email)
    .maybeSingle();

  if (profileError?.code === "42703") {
    const { data: fallbackProfile, error: fallbackError } = await supabase
      .from("usertable")
      .select(profileSelectBase)
      .eq("email", email)
      .maybeSingle();

    if (fallbackError) {
      console.error("user profile fallback fetch:", fallbackError);
      return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
    }

    profile = fallbackProfile;
    avatarStoragePath = null;
  } else if (profileError) {
    console.error("user profile fetch:", profileError);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  } else {
    profile = profileWithAvatar;
    avatarStoragePath = (profileWithAvatar?.avatar_storage_path as string | null) ?? null;
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const avatarUrl = await getSignedAvatarReadUrl(supabase, avatarStoragePath);

  return NextResponse.json(
    mapProfileRow(
      {
        ...profile,
        avatar_storage_path: avatarStoragePath,
      },
      avatarUrl
    )
  );
}
