import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import {
  MAX_PDF_UPLOAD_BYTES,
  MAX_PDF_UPLOAD_MB,
} from "@/lib/pdf-upload-limits";

const UPLOADS_BUCKET = "pdf_uploads";

function sanitizeFilename(input: string): string {
  // Keep only filename-safe characters; replace whitespace with `-`.
  const base = input.split(/[\\/]/).pop() ?? "upload.pdf";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "upload.pdf";
}

/**
 * POST /api/upload/create-signed-url
 *
 * Issues a one-shot Supabase Storage signed upload URL so the client can PUT
 * the PDF directly to Storage without going through `/api/upload/analyze`.
 * This bypasses Vercel's 4.5 MB request body limit and lets us accept files
 * up to {@link MAX_PDF_UPLOAD_MB} MB.
 *
 * Body: `{ userEmail: string, filename: string, contentType?: string, size?: number }`
 * Response: `{ bucket, storagePath, signedUrl, token }`
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          userEmail?: unknown;
          filename?: unknown;
          contentType?: unknown;
          size?: unknown;
        }
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const userEmail =
      typeof body.userEmail === "string" ? body.userEmail.trim().toLowerCase() : "";
    const filenameRaw =
      typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : "";
    const size = typeof body.size === "number" ? body.size : null;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required." },
        { status: 401 }
      );
    }
    if (!filenameRaw) {
      return NextResponse.json(
        { error: "Filename is required." },
        { status: 400 }
      );
    }
    if (contentType && contentType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only application/pdf uploads are accepted." },
        { status: 400 }
      );
    }
    if (size != null && (size <= 0 || size > MAX_PDF_UPLOAD_BYTES)) {
      return NextResponse.json(
        {
          error: `PDF must be between 1 byte and ${MAX_PDF_UPLOAD_MB} MB.`,
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: userRow, error: userCheckError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (userCheckError || !userRow) {
      return NextResponse.json(
        {
          error:
            "Account not fully set up. Please sign out and complete registration again, or contact support.",
        },
        { status: 403 }
      );
    }

    const cleanName = sanitizeFilename(filenameRaw);
    const storagePath = `pending/${userEmail}/${randomUUID()}-${cleanName}`;

    const { data, error } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl || !data?.token) {
      const isDev = process.env.NODE_ENV === "development";
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json(
        {
          error: `Could not create upload URL.${isDev && error ? ` ${error.message}` : ""}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bucket: UPLOADS_BUCKET,
      storagePath: data.path ?? storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err) {
    console.error("create-signed-url error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create upload URL." },
      { status: 500 }
    );
  }
}
