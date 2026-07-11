import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-utils";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Reset password: Missing Supabase env");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 401 }
      );
    }

    const normalizedEmail = user.email.trim().toLowerCase();

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateAuthError) {
      console.error("Reset password updateUserById error:", updateAuthError);
      return NextResponse.json(
        { error: "Password could not be updated. Please try again." },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { data: updatedRow, error: tableError } = await supabase
      .from("usertable")
      .update({ password: passwordHash })
      .eq("email", normalizedEmail)
      .select("email")
      .maybeSingle();

    if (tableError) {
      console.error("Reset password usertable update error:", tableError);
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
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Password reset failed. Please try again." },
      { status: 500 }
    );
  }
}
