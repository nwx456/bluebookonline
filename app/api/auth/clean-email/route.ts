import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Removes an email from everywhere so the user can sign up again.
 * Order: child tables first (attempts, pdf_uploads), then pending_registrations, usertable, then Auth.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();

    await supabase.from("attempts").delete().eq("user_email", email);
    await supabase.from("pdf_uploads").delete().eq("user_email", email);
    await supabase.from("pending_registrations").delete().eq("email", email);

    const { error: userTableError } = await supabase.from("usertable").delete().eq("email", email);
    if (userTableError) {
      console.error("Clean email usertable delete:", userTableError);
      return NextResponse.json({ error: "Could not remove user. " + userTableError.message }, { status: 500 });
    }

    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const user = listData?.users?.find((u) => u.email?.toLowerCase() === email);
    if (user?.id) {
      await supabase.auth.admin.deleteUser(user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Email cleared. You can sign up again.",
    });
  } catch (err) {
    console.error("Clean email error:", err);
    return NextResponse.json({ error: "Clean failed." }, { status: 500 });
  }
}
