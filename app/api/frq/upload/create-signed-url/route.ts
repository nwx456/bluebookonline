import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/moderator-auth";
import {
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";

const UPLOADS_BUCKET = "pdf_uploads";

function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "frq-upload.pdf";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "frq-upload.pdf";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth.user?.email) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    const userEmail = normalizeEmail(auth.user.email);

    const body = (await request.json().catch(() => null)) as {
      filename?: string;
      contentType?: string;
      size?: number;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const filenameRaw = body.filename?.trim() ?? "";
    const contentType = body.contentType?.trim() ?? "";
    const size = typeof body.size === "number" ? body.size : null;

    if (!filenameRaw) {
      return NextResponse.json({ error: "Filename is required." }, { status: 400 });
    }
    if (contentType && contentType !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF uploads are accepted." }, { status: 400 });
    }
    if (size != null && (size <= 0 || size > MAX_PDF_UPLOAD_BYTES)) {
      return NextResponse.json(
        { error: `PDF must be between 1 byte and ${MAX_PDF_UPLOAD_MB} MB.` },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: userRow } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (!userRow) {
      return NextResponse.json({ error: "Account not found." }, { status: 403 });
    }

    const cleanName = sanitizeFilename(filenameRaw);
    const storagePath = `frq/${userEmail}/${randomUUID()}-${cleanName}`;

    const { data, error } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl || !data?.token) {
      console.error("frq create-signed-url storage:", error);
      return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
    }

    return NextResponse.json({
      bucket: UPLOADS_BUCKET,
      storagePath: data.path ?? storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err) {
    console.error("frq create-signed-url:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create upload URL." },
      { status: 500 }
    );
  }
}
