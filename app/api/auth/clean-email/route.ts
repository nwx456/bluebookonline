import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/account-deletion";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Removes an email from everywhere so signup can be retried.
 * Protected: requires authenticated owner OR admin secret OR pending-only cleanup.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const adminSecret = (process.env.CLEAN_EMAIL_SECRET ?? "").trim();
    const providedSecret = request.headers.get("x-clean-email-secret")?.trim();
    const isAdmin = Boolean(adminSecret && providedSecret === adminSecret);

    const { user } = await getAuthUser(request);
    const isOwner = user?.email?.trim().toLowerCase() === email;

    const { data: pending } = await supabase
      .from("pending_registrations")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    const { data: existingUser } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existingUser && !isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "An account exists for this email. Sign in and delete it from Privacy settings." },
        { status: 403 }
      );
    }

    if (!pending && !existingUser && !isAdmin) {
      return NextResponse.json({ error: "No registration found for this email." }, { status: 404 });
    }

    if (pending && !existingUser) {
      await supabase.from("pending_registrations").delete().eq("email", email);
      return NextResponse.json({
        success: true,
        message: "Pending registration cleared.",
      });
    }

    const { error } = await deleteUserAccount(supabase, email);
    if (error) {
      return NextResponse.json({ error: "Could not remove user." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Email cleared.",
    });
  } catch (err) {
    console.error("Clean email error:", err);
    return NextResponse.json({ error: "Clean failed." }, { status: 500 });
  }
}
