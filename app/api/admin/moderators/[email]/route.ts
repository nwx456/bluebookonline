import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * DELETE /api/admin/moderators/[email] — Deactivate a moderator.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { email: rawEmail } = await params;
    const email = normalizeEmail(decodeURIComponent(rawEmail ?? ""));
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: existing, error: fetchError } = await supabase
      .from("moderators")
      .select("email, active")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      console.error("admin/moderators delete fetch:", fetchError);
      return NextResponse.json({ error: "Could not remove moderator." }, { status: 500 });
    }

    if (!existing?.active) {
      return NextResponse.json({ error: "Moderator not found." }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("moderators")
      .update({ active: false })
      .eq("email", email);

    if (updateError) {
      console.error("admin/moderators delete:", updateError);
      return NextResponse.json({ error: "Could not remove moderator." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("admin/moderators DELETE:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
