import { NextRequest, NextResponse } from "next/server";
import { canAssignExamUpload, getTeacherClass } from "@/lib/class-server";
import { canAssignFrqUpload } from "@/lib/frq-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { requireTeacherUser } from "@/lib/teacher-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(_request);
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

  const { data: assignments, error } = await supabase
    .from("class_assignments")
    .select("id, kind, upload_id, frq_upload_id, resource_id, due_at, created_at")
    .eq("class_id", id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load assignments." }, { status: 500 });
  }

  return NextResponse.json({ assignments: assignments ?? [] });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireTeacherUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const kind =
    body.kind === "resource"
      ? "resource"
      : body.kind === "frq_exam"
        ? "frq_exam"
        : body.kind === "exam"
          ? "exam"
          : null;
  const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : null;
  const frqUploadId = typeof body.frqUploadId === "string" ? body.frqUploadId.trim() : null;
  const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : null;
  const dueAtRaw = body.dueAt ?? body.due_at;

  if (!kind) {
    return NextResponse.json({ error: "kind must be 'exam', 'frq_exam', or 'resource'." }, { status: 400 });
  }

  const supabase = createServerSupabaseAdmin();
  const teacherEmail = normalizeEmail(auth.user!.email);
  const cls = await getTeacherClass(supabase, id, teacherEmail);

  if (!cls || cls.archived_at) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  let dueAt: string | null = null;
  if (dueAtRaw) {
    const parsed = new Date(dueAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }
    dueAt = parsed.toISOString();
  }

  if (kind === "exam") {
    if (!uploadId) {
      return NextResponse.json({ error: "uploadId is required for exam assignments." }, { status: 400 });
    }
    const allowed = await canAssignExamUpload(supabase, uploadId, teacherEmail);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only assign your own exams or approved public exams." },
        { status: 403 }
      );
    }
  } else if (kind === "frq_exam") {
    if (!frqUploadId) {
      return NextResponse.json({ error: "frqUploadId is required for FRQ assignments." }, { status: 400 });
    }
    const allowed = await canAssignFrqUpload(supabase, frqUploadId, teacherEmail);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only assign your own FRQ exams." },
        { status: 403 }
      );
    }
  } else {
    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required for resource assignments." },
        { status: 400 }
      );
    }
    const { data: resource } = await supabase
      .from("teacher_resources")
      .select("teacher_email, archived_at")
      .eq("id", resourceId)
      .maybeSingle();

    if (
      !resource ||
      resource.archived_at ||
      normalizeEmail(resource.teacher_email as string) !== teacherEmail
    ) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("class_assignments")
    .insert({
      class_id: id,
      assigned_by: teacherEmail,
      kind,
      upload_id: kind === "exam" ? uploadId : null,
      frq_upload_id: kind === "frq_exam" ? frqUploadId : null,
      resource_id: kind === "resource" ? resourceId : null,
      due_at: kind === "exam" || kind === "frq_exam" ? dueAt : null,
    })
    .select("id, kind, upload_id, frq_upload_id, resource_id, due_at, created_at")
    .single();

  if (error) {
    console.error("create assignment:", error);
    return NextResponse.json({ error: "Could not create assignment." }, { status: 500 });
  }

  return NextResponse.json({ assignment: data });
}
