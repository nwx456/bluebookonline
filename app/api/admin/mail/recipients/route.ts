import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { getAuthUser } from "@/lib/admin-mail-auth";

/**
 * GET /api/admin/mail/recipients
 * All usertable rows (email + username) for the admin broadcast UI.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }
    if (!isAdminBroadcastEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("usertable")
      .select("email, username")
      .order("email", { ascending: true });

    if (error) {
      console.error("admin/mail/recipients:", error);
      return NextResponse.json({ error: "Could not load recipients." }, { status: 500 });
    }

    return NextResponse.json({
      recipients: (rows ?? []).map((r) => ({
        email: r.email as string,
        username: (r.username as string | null) ?? "",
      })),
    });
  } catch (e) {
    console.error("admin/mail/recipients:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
