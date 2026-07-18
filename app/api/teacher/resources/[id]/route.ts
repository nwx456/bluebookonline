import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/auth-session";
import { recordResourcePublishConsent } from "@/lib/legal/consent";
import { normalizeEmail } from "@/lib/moderator-auth";
import {
  canMakeResourcePrivate,
  canRequestResourcePublish,
  isResourcePendingReview,
} from "@/lib/resource-publish-utils";
import { mapTeacherResource } from "@/lib/teacher-resource-map";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

const RESOURCE_SELECT =
  "id, title, description, resource_type, file_name, file_size, mime_type, external_url, visibility, moderation_status, created_at, archived_at, teacher_email";

async function loadOwnedResource(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  id: string,
  teacherEmail: string
) {
  const { data: resource, error } = await supabase
    .from("teacher_resources")
    .select(RESOURCE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !resource || resource.archived_at) {
    return null;
  }
  if (normalizeEmail(resource.teacher_email as string) !== teacherEmail) {
    return null;
  }
  return resource;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();
  const resource = await loadOwnedResource(supabase, id, teacherEmail);

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  return NextResponse.json({ resource: mapTeacherResource(resource) });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();
  const existing = await loadOwnedResource(supabase, id, teacherEmail);

  if (!existing) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  const current = mapTeacherResource(existing);
  const pending = isResourcePendingReview(current);

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 200) {
      return NextResponse.json({ error: "Title is required (max 200 characters)." }, { status: 400 });
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  if (existing.resource_type === "link" && typeof body.externalUrl === "string") {
    const externalUrl = body.externalUrl.trim();
    if (!externalUrl || !/^https?:\/\//i.test(externalUrl)) {
      return NextResponse.json({ error: "A valid https URL is required for links." }, { status: 400 });
    }
    updates.external_url = externalUrl;
  }

  if (body.visibility !== undefined) {
    if (pending) {
      return NextResponse.json(
        { error: "Visibility cannot be changed while moderation is pending." },
        { status: 400 }
      );
    }

    const nextVisibility = body.visibility === "public" ? "public" : "private";

    if (nextVisibility === "public") {
      if (!canRequestResourcePublish(current)) {
        return NextResponse.json(
          { error: "This resource cannot be submitted for public review right now." },
          { status: 400 }
        );
      }
      if (body.publishConsent !== true) {
        return NextResponse.json(
          { error: "You must accept responsibility for publishing this resource publicly." },
          { status: 400 }
        );
      }
      updates.visibility = "public";
      updates.moderation_status = "pending_review";
    } else if (nextVisibility === "private") {
      if (!canMakeResourcePrivate(current)) {
        return NextResponse.json(
          { error: "Only published public resources can be made private." },
          { status: 400 }
        );
      }
      updates.visibility = "private";
      updates.moderation_status = "draft";
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("teacher_resources")
    .update(updates)
    .eq("id", id)
    .select(
      "id, title, description, resource_type, file_name, file_size, mime_type, external_url, visibility, moderation_status, created_at"
    )
    .single();

  if (error) {
    console.error("teacher/resources PATCH:", error);
    return NextResponse.json({ error: "Could not update resource." }, { status: 500 });
  }

  if (updates.visibility === "public" && updates.moderation_status === "pending_review") {
    await recordResourcePublishConsent(supabase, {
      userEmail: teacherEmail,
      resourceId: id,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      source: "teacher_resource_update",
    });
  }

  return NextResponse.json({ resource: mapTeacherResource(data) });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(_request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const teacherEmail = normalizeEmail(auth.user!.email);
  const supabase = createServerSupabaseAdmin();
  const resource = await loadOwnedResource(supabase, id, teacherEmail);

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("teacher_resources")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not delete resource." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
