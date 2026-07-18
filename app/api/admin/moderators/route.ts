import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/moderators — List active moderators.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("moderators")
      .select("email, added_by, created_at, active")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("admin/moderators list:", error);
      return NextResponse.json({ error: "Could not load moderators." }, { status: 500 });
    }

    return NextResponse.json(
      { moderators: data ?? [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    console.error("admin/moderators GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

/**
 * POST /api/admin/moderators — Add moderator by email.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email as string);
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const adminEmail = normalizeEmail(auth.user.email);

    const { data: existing } = await supabase
      .from("moderators")
      .select("email, active")
      .eq("email", email)
      .maybeSingle();

    if (existing?.active) {
      return NextResponse.json({ error: "This email is already a moderator." }, { status: 409 });
    }

    if (existing && !existing.active) {
      const { error: updateError } = await supabase
        .from("moderators")
        .update({ active: true, added_by: adminEmail, created_at: new Date().toISOString() })
        .eq("email", email);

      if (updateError) {
        console.error("admin/moderators reactivate:", updateError);
        return NextResponse.json({ error: "Could not add moderator." }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from("moderators").insert({
        email,
        added_by: adminEmail,
        active: true,
      });

      if (insertError) {
        console.error("admin/moderators insert:", insertError);
        return NextResponse.json({ error: "Could not add moderator." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, email });
  } catch (e) {
    console.error("admin/moderators POST:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
