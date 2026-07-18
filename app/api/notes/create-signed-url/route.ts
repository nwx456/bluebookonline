import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import {
  buildNotesPendingPath,
  NOTES_UPLOADS_BUCKET,
  validateNotesSignedUploadInput,
} from "@/lib/notes-storage";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/** POST /api/notes/create-signed-url */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Authentication required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      filename?: unknown;
      contentType?: unknown;
      size?: unknown;
    } | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "";
    const size = typeof body.size === "number" ? body.size : null;

    const validation = validateNotesSignedUploadInput({ filename, contentType, size });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();

    const { data: userRow, error: userCheckError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (userCheckError || !userRow) {
      return NextResponse.json(
        { error: "Account not fully set up. Please sign in again." },
        { status: 403 }
      );
    }

    const storagePath = buildNotesPendingPath(userEmail, filename);

    const { data, error } = await supabase.storage
      .from(NOTES_UPLOADS_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error || !data?.signedUrl || !data?.token) {
      console.error("notes create-signed-url:", error);
      return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
    }

    return NextResponse.json({
      bucket: NOTES_UPLOADS_BUCKET,
      storagePath: data.path ?? storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err) {
    console.error("notes create-signed-url error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create upload URL." },
      { status: 500 }
    );
  }
}
