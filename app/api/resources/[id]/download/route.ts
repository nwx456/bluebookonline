import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { CLASS_RESOURCES_BUCKET, isResourceAccessibleToStudent } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const userEmail = normalizeEmail(user.email);
  const supabase = createServerSupabaseAdmin();

  const { data: resource, error } = await supabase
    .from("teacher_resources")
    .select(
      "id, teacher_email, resource_type, storage_path, file_name, external_url, visibility, moderation_status, archived_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !resource || resource.archived_at) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const allowed = await isResourceAccessibleToStudent(supabase, id, userEmail);
  if (!allowed) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  if (resource.resource_type === "link") {
    return NextResponse.json({
      type: "link",
      url: resource.external_url,
      fileName: resource.file_name ?? resource.external_url,
    });
  }

  if (!resource.storage_path) {
    return NextResponse.json({ error: "File not available." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(CLASS_RESOURCES_BUCKET)
    .createSignedUrl(resource.storage_path as string, 3600);

  if (signError || !signed?.signedUrl) {
    console.error("resource download signed url:", signError);
    return NextResponse.json({ error: "Could not generate download URL." }, { status: 500 });
  }

  return NextResponse.json({
    type: "file",
    url: signed.signedUrl,
    fileName: resource.file_name ?? "download",
  });
}
