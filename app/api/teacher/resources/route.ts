import { NextRequest, NextResponse } from "next/server";
import { mapTeacherResource } from "@/lib/teacher-resource-map";
import { getClientIp } from "@/lib/auth-session";
import { recordResourcePublishConsent } from "@/lib/legal/consent";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();

  const { data, error } = await supabase
    .from("teacher_resources")
    .select(
      "id, title, description, resource_type, file_name, file_size, mime_type, external_url, visibility, moderation_status, created_at, archived_at"
    )
    .eq("teacher_email", teacherEmail)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load resources." }, { status: 500 });
  }

  return NextResponse.json({
    resources: (data ?? []).map((row) => mapTeacherResource(row)),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const resourceType = body.resourceType === "link" ? "link" : "file";
  const visibility = body.visibility === "public" ? "public" : "private";
  const externalUrl =
    typeof body.externalUrl === "string" ? body.externalUrl.trim() : null;
  const storagePath =
    typeof body.storagePath === "string" ? body.storagePath.trim() : null;
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : null;
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : null;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : null;
  const publishConsent = body.publishConsent === true;

  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Title is required (max 200 characters)." }, { status: 400 });
  }

  if (resourceType === "link") {
    if (!externalUrl || !/^https?:\/\//i.test(externalUrl)) {
      return NextResponse.json({ error: "A valid https URL is required for links." }, { status: 400 });
    }
  } else if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required for file resources." }, { status: 400 });
  }

  if (visibility === "public" && !publishConsent) {
    return NextResponse.json(
      { error: "You must accept responsibility for publishing this resource publicly." },
      { status: 400 }
    );
  }

  const teacherEmail = normalizeEmail(auth.user!.email);
  const moderationStatus = visibility === "public" ? "pending_review" : "draft";

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("teacher_resources")
    .insert({
      teacher_email: teacherEmail,
      title,
      description: description || null,
      resource_type: resourceType,
      storage_path: resourceType === "file" ? storagePath : null,
      file_name: resourceType === "file" ? fileName : null,
      file_size: resourceType === "file" ? fileSize : null,
      mime_type: resourceType === "file" ? mimeType : null,
      external_url: resourceType === "link" ? externalUrl : null,
      visibility,
      moderation_status: moderationStatus,
    })
    .select("id, title, visibility, moderation_status, resource_type, created_at")
    .single();

  if (error) {
    console.error("teacher/resources POST:", error);
    return NextResponse.json({ error: "Could not create resource." }, { status: 500 });
  }

  if (visibility === "public") {
    await recordResourcePublishConsent(supabase, {
      userEmail: teacherEmail,
      resourceId: String(data.id),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  }

  return NextResponse.json({ resource: data });
}
