import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { CLASS_RESOURCES_BUCKET } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const MAX_RESOURCE_BYTES = 50 * 1024 * 1024;

function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "resource.pdf";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "resource.pdf";
}

/** POST /api/teacher/resources/create-signed-url */
export async function POST(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const size = typeof body.size === "number" ? body.size : null;

  if (!filename) {
    return NextResponse.json({ error: "Filename is required." }, { status: 400 });
  }
  if (size != null && (size <= 0 || size > MAX_RESOURCE_BYTES)) {
    return NextResponse.json({ error: "File must be between 1 byte and 50 MB." }, { status: 400 });
  }

  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();
  const cleanName = sanitizeFilename(filename);
  const storagePath = `${teacherEmail}/${randomUUID()}-${cleanName}`;

  const { data, error } = await supabase.storage
    .from(CLASS_RESOURCES_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    console.error("resource signed url:", error);
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 });
  }

  return NextResponse.json({
    bucket: CLASS_RESOURCES_BUCKET,
    storagePath: data.path ?? storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
