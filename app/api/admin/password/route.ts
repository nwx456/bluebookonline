import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-utils";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/admin/password — change the logged-in admin's password.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }

    if (!newPassword) {
      return NextResponse.json({ error: "New password is required." }, { status: 400 });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current password." },
        { status: 400 }
      );
    }

    const email = auth.user.email!.trim().toLowerCase();
    const supabaseAuth = createServerSupabaseClient();
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const supabase = createServerSupabaseAdmin();
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(auth.user.id, {
      password: newPassword,
    });

    if (updateAuthError) {
      console.error("admin password updateUserById error:", updateAuthError);
      return NextResponse.json(
        { error: "Password could not be updated. Please try again." },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const { data: updatedRow, error: tableError } = await supabase
      .from("usertable")
      .update({ password: passwordHash })
      .eq("email", email)
      .select("email")
      .maybeSingle();

    if (tableError) {
      console.error("admin password usertable update error:", tableError);
      return NextResponse.json(
        { error: "Profile could not be updated. Please try again." },
        { status: 500 }
      );
    }

    if (!updatedRow) {
      return NextResponse.json(
        { error: "Account profile not found. Please contact support." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("POST /api/admin/password:", err);
    return NextResponse.json(
      { error: "Password update failed. Please try again." },
      { status: 500 }
    );
  }
}
