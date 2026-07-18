import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/admin-mail-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  try {
    const userEmail = normalizeEmail(user.email);
    const supabase = createServerSupabaseAdmin();
    const limit = Math.min(
      Math.max(Number(new URL(request.url).searchParams.get("limit") ?? "20"), 1),
      50
    );

    const [{ data: notifications, error }, unreadCount] = await Promise.all([
      supabase
        .from("user_notifications")
        .select("id, type, title, body, metadata, read_at, created_at")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(limit),
      getUnreadNotificationCount(userEmail),
    ]);

    if (error) {
      console.error("GET notifications error:", error);
      return NextResponse.json({ error: "Failed to load notifications." }, { status: 500 });
    }

    return NextResponse.json({ notifications: notifications ?? [], unreadCount });
  } catch (err) {
    console.error("GET /api/user/notifications error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userEmail = normalizeEmail(user.email);
    const supabase = createServerSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.markAllRead === true) {
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: now })
        .eq("user_email", userEmail)
        .is("read_at", null);

      if (error) {
        return NextResponse.json({ error: "Failed to mark notifications read." }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No notification ids provided." }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("user_email", userEmail)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: "Failed to mark notifications read." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/user/notifications error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
