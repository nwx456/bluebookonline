import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/account-deletion";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Send { "confirm": "DELETE" } to permanently delete your account.' },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseAdmin();
  const { error } = await deleteUserAccount(supabase, user.email);

  if (error) {
    return NextResponse.json({ error: "Account deletion failed. Please contact support." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Account deleted." });
}
