import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { sendBroadcastMessage } from "@/lib/nodemailer";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token)
    return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    return {
      user: null,
      error: "Invalid or expired session. Please sign in again.",
    };
  return { user, error: null };
}

const SEND_GAP_MS = 550;

function displayNameForRow(email: string, username: string | null | undefined): string {
  const u = username?.trim();
  if (u) return u;
  const local = email.split("@")[0];
  return local || email;
}

/**
 * POST /api/admin/mail/send
 * Body: { subject: string, body: string, recipientEmails: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }
    if (!isAdminBroadcastEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const messageBody = typeof body?.body === "string" ? body.body : "";
    const rawList = Array.isArray(body?.recipientEmails) ? body.recipientEmails : [];

    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    const trimmedMessage = messageBody.trim();
    if (!trimmedMessage) {
      return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    }

    const normalizedSet = new Set<string>();
    for (const item of rawList) {
      if (typeof item !== "string") continue;
      const e = item.trim().toLowerCase();
      if (e) normalizedSet.add(e);
    }
    const normalizedList = [...normalizedSet];
    if (normalizedList.length === 0) {
      return NextResponse.json({ error: "Select at least one recipient." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: rows, error: dbError } = await supabase
      .from("usertable")
      .select("email, username")
      .in("email", normalizedList);

    if (dbError) {
      console.error("admin/mail/send lookup:", dbError);
      return NextResponse.json({ error: "Could not resolve recipients." }, { status: 500 });
    }

    const foundEmails = new Set((rows ?? []).map((r) => String(r.email).toLowerCase()));
    const skipped = normalizedList.filter((e) => !foundEmails.has(e)).length;

    const list = rows ?? [];
    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const email = String(row.email).trim().toLowerCase();
      const greeting = displayNameForRow(email, row.username as string | null | undefined);
      try {
        await sendBroadcastMessage({
          to: email,
          subject,
          username: greeting,
          messageBody: trimmedMessage,
        });
        sent++;
      } catch (err) {
        failed++;
        if (!firstError) {
          firstError = err instanceof Error ? err.message : "Send failed.";
        }
      }
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, SEND_GAP_MS));
      }
    }

    return NextResponse.json({
      sent,
      failed,
      skipped,
      firstError,
    });
  } catch (e) {
    console.error("admin/mail/send:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
