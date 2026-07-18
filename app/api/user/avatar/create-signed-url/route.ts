import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  AVATARS_BUCKET,
  avatarExtensionFromFilename,
  buildAvatarStoragePath,
  MAX_AVATAR_BYTES,
  normalizeUserEmail,
} from "@/lib/user-profile";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const size = typeof body.size === "number" ? body.size : null;

  if (!filename) {
    return NextResponse.json({ error: "Filename is required." }, { status: 400 });
  }

  const ext = avatarExtensionFromFilename(filename);
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed." },
      { status: 400 }
    );
  }

  if (size != null && (size <= 0 || size > MAX_AVATAR_BYTES)) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 2 MB." },
      { status: 400 }
    );
  }

  const email = normalizeUserEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: profile } = await supabase
    .from("usertable")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const storagePath = buildAvatarStoragePath(email, ext);

  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (error || !data?.signedUrl) {
    console.error("avatar create-signed-url:", error);
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
  }

  return NextResponse.json({
    bucket: AVATARS_BUCKET,
    storagePath: data.path ?? storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
