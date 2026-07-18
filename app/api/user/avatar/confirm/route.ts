import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  getSignedAvatarReadUrl,
  isAvatarStoragePathForUser,
  normalizeUserEmail,
  removeAvatarFromStorage,
} from "@/lib/user-profile";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const storagePath =
    typeof body.storagePath === "string" ? body.storagePath.trim() : "";
  const remove = body.remove === true;

  const email = normalizeUserEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: existing } = await supabase
    .from("usertable")
    .select("avatar_storage_path")
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  if (remove) {
    const oldPath = existing.avatar_storage_path as string | null;
    await removeAvatarFromStorage(supabase, oldPath);
    await supabase
      .from("usertable")
      .update({ avatar_storage_path: null })
      .eq("email", email);

    return NextResponse.json({ success: true, avatarUrl: null });
  }

  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  if (!isAvatarStoragePathForUser(storagePath, email)) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 403 });
  }

  const oldPath = existing.avatar_storage_path as string | null;
  if (oldPath && oldPath !== storagePath) {
    await removeAvatarFromStorage(supabase, oldPath);
  }

  const { error: updateError } = await supabase
    .from("usertable")
    .update({ avatar_storage_path: storagePath })
    .eq("email", email);

  if (updateError) {
    console.error("avatar confirm update:", updateError);
    return NextResponse.json({ error: "Could not save avatar." }, { status: 500 });
  }

  const avatarUrl = await getSignedAvatarReadUrl(supabase, storagePath);

  return NextResponse.json({ success: true, avatarUrl });
}
