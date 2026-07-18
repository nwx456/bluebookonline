import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

type PatchBody = {
  displayTitle?: string | null;
  personalNotes?: string | null;
  archived?: boolean;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as PatchBody;
    const updates: Record<string, string | null> = {};

    if ("displayTitle" in body) {
      const value = body.displayTitle?.trim() ?? "";
      updates.display_title = value || null;
    }
    if ("personalNotes" in body) {
      const value = body.personalNotes?.trim() ?? "";
      updates.personal_notes = value || null;
    }
    if ("archived" in body) {
      updates.archived_at = body.archived ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const userEmail = user.email.trim().toLowerCase();

    const { data, error } = await supabase
      .from("frq_uploads")
      .update(updates)
      .eq("id", id)
      .eq("user_email", userEmail)
      .select("id, display_title, personal_notes, archived_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "FRQ exam not found." }, { status: 404 });
    }

    return NextResponse.json({
      upload: {
        id: data.id,
        displayTitle: data.display_title,
        personalNotes: data.personal_notes,
        archivedAt: data.archived_at,
      },
    });
  } catch (err) {
    console.error("[library/frq-uploads/[id] PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
