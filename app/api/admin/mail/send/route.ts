import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { getAuthUser } from "@/lib/admin-mail-auth";
import {
  checkAdminMailRateLimits,
  getJobThreshold,
  getWorkerBatchSize,
} from "@/lib/admin-mail-limits";
import {
  ADMIN_BROADCAST_SEND_GAP_MS,
  displayNameForRow,
} from "@/lib/admin-broadcast-helpers";
import {
  fetchAllRegisteredRecipients,
  lookupRecipientsByEmail,
  type MailRecipientRow,
} from "@/lib/admin-mail-recipients";
import {
  getMailWorkerBaseUrl,
  isMailWorkerKickConfigured,
} from "@/lib/admin-mail-worker-auth";
import { getMailConfigError } from "@/lib/mail/from-address";
import { sendBroadcastMessage } from "@/lib/nodemailer";

const BODY_PREVIEW_LEN = 200;

function scheduleMailWorkerKick(jobId: string, totalRecipients: number) {
  const secret = (process.env.MAIL_WORKER_SECRET ?? "").trim();
  const base = getMailWorkerBaseUrl();
  if (!secret || !base) return;

  const batchSize = getWorkerBatchSize();
  const maxRounds = Math.min(Math.ceil(totalRecipients / batchSize) + 2, 50);

  after(async () => {
    try {
      for (let i = 0; i < maxRounds; i++) {
        const res = await fetch(`${base}/api/internal/mail-worker`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-mail-worker-secret": secret,
          },
          body: JSON.stringify({ jobId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          processed?: boolean;
          status?: string;
        };
        if (!res.ok) {
          console.error("mail worker kick HTTP:", res.status, data);
          break;
        }
        if (!data.processed) break;
        if (data.status === "done" || data.status === "failed") break;
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (e) {
      console.error("mail worker kick failed:", e);
    }
  });
}

async function sendToRecipientList(
  list: MailRecipientRow[],
  subject: string,
  trimmedMessage: string
): Promise<{ sent: number; failed: number; firstError: string | null }> {
  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const email = row.email;
    const greeting = displayNameForRow(email, row.username);
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
      await new Promise((r) => setTimeout(r, ADMIN_BROADCAST_SEND_GAP_MS));
    }
  }

  return { sent, failed, firstError };
}

/**
 * POST /api/admin/mail/send
 * Body: { subject, body, recipientEmails?, sendToAllRegistered?, testOnly?, testTo? }
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

    const mailConfigError = getMailConfigError();
    if (mailConfigError) {
      return NextResponse.json(
        { error: `Mail is not configured: ${mailConfigError}` },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const messageBody = typeof body?.body === "string" ? body.body : "";
    const rawList = Array.isArray(body?.recipientEmails) ? body.recipientEmails : [];
    const sendToAllRegistered = body?.sendToAllRegistered === true;
    const testOnly = body?.testOnly === true;
    const testToRaw =
      typeof body?.testTo === "string" ? body.testTo.trim().toLowerCase() : "";

    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    const trimmedMessage = messageBody.trim();
    if (!trimmedMessage) {
      return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const adminEmail = user.email.trim().toLowerCase();
    const preview = trimmedMessage.slice(0, BODY_PREVIEW_LEN);

    if (testOnly) {
      const target = (testToRaw || adminEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
        return NextResponse.json({ error: "Invalid test recipient email." }, { status: 400 });
      }
      let sent = 0;
      let failed = 0;
      let firstError: string | null = null;
      try {
        await sendBroadcastMessage({
          to: target,
          subject: `[TEST] ${subject}`,
          username: "Test",
          messageBody: trimmedMessage,
        });
        sent = 1;
      } catch (err) {
        failed = 1;
        firstError = err instanceof Error ? err.message : "Send failed.";
      }
      const { error: logErr } = await supabase.from("admin_mail_log").insert({
        admin_email: adminEmail,
        subject,
        body_preview: preview,
        recipient_count: 1,
        sent,
        failed,
        skipped: 0,
        first_error: firstError,
        is_test: true,
      });
      if (logErr) console.error("admin_mail_log test insert:", logErr);

      return NextResponse.json({
        sent,
        failed,
        skipped: 0,
        firstError,
        test: true,
      });
    }

    let list: MailRecipientRow[] = [];
    let skipped = 0;

    if (sendToAllRegistered) {
      try {
        list = await fetchAllRegisteredRecipients(supabase);
      } catch (dbError) {
        console.error("admin/mail/send fetchAll:", dbError);
        return NextResponse.json({ error: "Could not load recipients." }, { status: 500 });
      }
      if (list.length === 0) {
        return NextResponse.json({ error: "No registered users to email." }, { status: 400 });
      }
    } else {
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

      try {
        const lookup = await lookupRecipientsByEmail(supabase, normalizedList);
        list = lookup.rows;
        skipped = lookup.skipped;
      } catch (dbError) {
        console.error("admin/mail/send lookup:", dbError);
        return NextResponse.json({ error: "Could not resolve recipients." }, { status: 500 });
      }

      if (list.length === 0) {
        return NextResponse.json(
          { error: "None of the selected addresses exist in usertable.", skipped },
          { status: 400 }
        );
      }
    }

    const rateErr = await checkAdminMailRateLimits(list.length);
    if (rateErr) {
      return NextResponse.json({ error: rateErr }, { status: 429 });
    }

    const threshold = getJobThreshold();

    if (list.length >= threshold) {
      const payload = list.map((r) => ({
        email: r.email,
        username: r.username,
      }));

      const { data: jobRow, error: jobInsErr } = await supabase
        .from("outbound_email_jobs")
        .insert({
          admin_email: adminEmail,
          status: "pending",
          subject,
          body: trimmedMessage,
          recipients: payload,
          total_recipients: list.length,
          skipped,
          cursor_index: 0,
          sent: 0,
          failed: 0,
        })
        .select("id")
        .maybeSingle();

      if (jobInsErr || !jobRow?.id) {
        console.error("outbound_email_jobs insert:", jobInsErr);
        return NextResponse.json(
          { error: "Could not queue broadcast. Apply docs/schema_mail_ops.sql if missing." },
          { status: 500 }
        );
      }

      const jobId = jobRow.id as string;

      const { error: logErr } = await supabase.from("admin_mail_log").insert({
        admin_email: adminEmail,
        subject,
        body_preview: preview,
        recipient_count: list.length,
        sent: 0,
        failed: 0,
        skipped,
        first_error: null,
        is_test: false,
        job_id: jobId,
      });
      if (logErr) console.error("admin_mail_log queue insert:", logErr);

      scheduleMailWorkerKick(jobId, list.length);

      const workerWarning = isMailWorkerKickConfigured()
        ? null
        : "Worker auto-kick is not configured (set MAIL_WORKER_SECRET and NEXT_PUBLIC_BASE_URL). Cron will still process the job if CRON_SECRET is set on Vercel.";

      return NextResponse.json(
        {
          queued: true,
          jobId,
          skipped,
          totalRecipients: list.length,
          workerWarning,
          message:
            "Broadcast queued. Progress updates as the worker runs (cron or automatic kick).",
        },
        { status: 202 }
      );
    }

    const { sent, failed, firstError } = await sendToRecipientList(
      list,
      subject,
      trimmedMessage
    );

    const { error: logErr } = await supabase.from("admin_mail_log").insert({
      admin_email: adminEmail,
      subject,
      body_preview: preview,
      recipient_count: list.length,
      sent,
      failed,
      skipped,
      first_error: firstError,
      is_test: false,
    });
    if (logErr) console.error("admin_mail_log sync insert:", logErr);

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
