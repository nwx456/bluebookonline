import { NextRequest, NextResponse } from "next/server";
import { getTeacherClass, usernamesForEmails } from "@/lib/class-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const [{ data: members }, { data: assignments }] = await Promise.all([
    supabase
      .from("class_members")
      .select("student_email, joined_at")
      .eq("class_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("class_assignments")
      .select(
        "id, kind, upload_id, frq_upload_id, resource_id, due_at, created_at, archived_at"
      )
      .eq("class_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const memberEmails = (members ?? []).map((m) =>
    normalizeEmail(m.student_email as string)
  );
  const usernameMap = await usernamesForEmails(supabase, memberEmails);

  const uploadIds = (assignments ?? [])
    .filter((a) => a.kind === "exam" && a.upload_id)
    .map((a) => String(a.upload_id));
  const frqUploadIds = (assignments ?? [])
    .filter((a) => a.kind === "frq_exam" && a.frq_upload_id)
    .map((a) => String(a.frq_upload_id));
  const resourceIds = (assignments ?? [])
    .filter((a) => a.kind === "resource" && a.resource_id)
    .map((a) => String(a.resource_id));

  let uploadMeta: Record<
    string,
    { title: string; isPublished: boolean; moderationStatus: string }
  > = {};
  if (uploadIds.length > 0) {
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, display_title, is_published, moderation_status")
      .in("id", uploadIds);
    uploadMeta = Object.fromEntries(
      (uploads ?? []).map((u) => [
        String(u.id),
        {
          title:
            (u.display_title as string | null)?.trim() || (u.filename as string) || "Exam",
          isPublished: u.is_published === true,
          moderationStatus: (u.moderation_status as string) ?? "draft",
        },
      ])
    );
  }

  let frqMeta: Record<
    string,
    { title: string; isPublished: boolean; moderationStatus: string }
  > = {};
  if (frqUploadIds.length > 0) {
    const { data: frqUploads } = await supabase
      .from("frq_uploads")
      .select("id, title, is_published, moderation_status")
      .in("id", frqUploadIds);
    frqMeta = Object.fromEntries(
      (frqUploads ?? []).map((u) => [
        String(u.id),
        {
          title: (u.title as string) || "FRQ Exam",
          isPublished: u.is_published === true,
          moderationStatus: (u.moderation_status as string) ?? "draft",
        },
      ])
    );
  }

  let resourceMeta: Record<
    string,
    {
      title: string;
      resourceType: "file" | "link";
      visibility: "private" | "public";
      moderationStatus: string;
      externalUrl: string | null;
      fileName: string | null;
    }
  > = {};
  if (resourceIds.length > 0) {
    const { data: resources } = await supabase
      .from("teacher_resources")
      .select(
        "id, title, resource_type, visibility, moderation_status, external_url, file_name"
      )
      .in("id", resourceIds);
    resourceMeta = Object.fromEntries(
      (resources ?? []).map((r) => [
        String(r.id),
        {
          title: r.title as string,
          resourceType: r.resource_type === "link" ? "link" : "file",
          visibility: r.visibility === "public" ? "public" : "private",
          moderationStatus: (r.moderation_status as string) ?? "draft",
          externalUrl: (r.external_url as string | null) ?? null,
          fileName: (r.file_name as string | null) ?? null,
        },
      ])
    );
  }

  return NextResponse.json({
    class: {
      id: cls.id,
      name: cls.name,
      description: cls.description,
      classCode: cls.class_code,
      createdAt: cls.created_at,
      archivedAt: cls.archived_at,
    },
    members: (members ?? []).map((m) => {
      const email = normalizeEmail(m.student_email as string);
      return {
        email,
        username: usernameMap[email] ?? email.split("@")[0],
        joinedAt: m.joined_at,
      };
    }),
    assignments: (assignments ?? []).map((a) => {
      if (a.kind === "exam") {
        const meta = uploadMeta[String(a.upload_id)] ?? {
          title: "Exam",
          isPublished: false,
          moderationStatus: "draft",
        };
        return {
          id: a.id,
          kind: a.kind,
          uploadId: a.upload_id,
          frqUploadId: null,
          resourceId: null,
          title: meta.title,
          dueAt: a.due_at,
          createdAt: a.created_at,
          content: {
            isPublished: meta.isPublished,
            moderationStatus: meta.moderationStatus,
          },
        };
      }
      if (a.kind === "frq_exam") {
        const meta = frqMeta[String(a.frq_upload_id)] ?? {
          title: "FRQ Exam",
          isPublished: false,
          moderationStatus: "draft",
        };
        return {
          id: a.id,
          kind: a.kind,
          uploadId: null,
          frqUploadId: a.frq_upload_id,
          resourceId: null,
          title: meta.title,
          dueAt: a.due_at,
          createdAt: a.created_at,
          content: {
            isPublished: meta.isPublished,
            moderationStatus: meta.moderationStatus,
          },
        };
      }
      const meta = resourceMeta[String(a.resource_id)] ?? {
        title: "Resource",
        resourceType: "file" as const,
        visibility: "private" as const,
        moderationStatus: "draft",
        externalUrl: null,
        fileName: null,
      };
      return {
        id: a.id,
        kind: a.kind,
        uploadId: null,
        frqUploadId: null,
        resourceId: a.resource_id,
        title: meta.title,
        dueAt: a.due_at,
        createdAt: a.created_at,
        content: {
          resourceType: meta.resourceType,
          visibility: meta.visibility,
          moderationStatus: meta.moderationStatus,
          externalUrl: meta.externalUrl,
          fileName: meta.fileName,
        },
      };
    }),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim().slice(0, 120);
  }
  if (typeof body.description === "string") {
    updates.description = body.description.trim() || null;
  }
  if (body.archive === true) {
    updates.archived_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { error } = await supabase.from("classes").update(updates).eq("id", id);

  if (error) {
    console.error("teacher/classes PATCH:", error);
    return NextResponse.json({ error: "Could not update class." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const { error } = await supabase.from("classes").delete().eq("id", id);

  if (error) {
    console.error("teacher/classes DELETE:", error);
    return NextResponse.json({ error: "Could not delete class." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
