import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/institutions/[id] — Update institution status.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

    if (statusRaw !== "active" && statusRaw !== "suspended") {
      return NextResponse.json(
        { error: "Status must be 'active' or 'suspended'." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("institutions")
      .update({ status: statusRaw })
      .eq("id", id)
      .select("id, owner_email, name, join_code, status, created_at")
      .maybeSingle();

    if (error) {
      console.error("admin/institutions PATCH:", error);
      return NextResponse.json({ error: "Could not update institution." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }

    return NextResponse.json({
      institution: {
        id: data.id,
        ownerEmail: data.owner_email,
        name: data.name,
        joinCode: data.join_code,
        status: data.status,
        createdAt: data.created_at,
      },
    });
  } catch (e) {
    console.error("admin/institutions PATCH:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
