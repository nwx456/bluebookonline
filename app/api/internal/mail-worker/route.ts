import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { sendBroadcastMessage } from "@/lib/nodemailer";
import {
  displayNameForRow,
  ADMIN_BROADCAST_SEND_GAP_MS,
} from "@/lib/admin-broadcast-helpers";
import { getWorkerBatchSize } from "@/lib/admin-mail-limits";

type RecipientRow = { email: string; username?: string | null };

type MailJobRow = {
  id: string;
  status: string;
  subject: string;
  body: string;
  recipients: unknown;
  cursor_index: number;
  total_recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  first_error: string | null;
};

/**
 * POST /api/internal/mail-worker
 * Header: x-mail-worker-secret: MAIL_WORKER_SECRET
 * Body (optional): { jobId?: string }
 * Processes one batch of a queued outbound_email_jobs row.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-mail-worker-secret");
    const expected = (process.env.MAIL_WORKER_SECRET ?? "").trim();
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const jobId =
      typeof body?.jobId === "string" && body.jobId.trim() ? body.jobId.trim() : null;

    const supabase = createServerSupabaseAdmin();
    let job: MailJobRow | null = null;

    if (jobId) {
      const { data, error } = await supabase
        .from("outbound_email_jobs")
        .select(
          "id, status, subject, body, recipients, cursor_index, total_recipients, sent, failed, skipped, first_error"
        )
        .eq("id", jobId)
        .maybeSingle();
      if (error) {
        console.error("mail-worker fetch job:", error);
        return NextResponse.json({ error: "DB error." }, { status: 500 });
      }
      job = (data as MailJobRow | null) ?? null;
      if (job?.status === "pending") {
        const { data: claimed, error: claimErr } = await supabase
          .from("outbound_email_jobs")
          .update({
            status: "processing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "pending")
          .select(
            "id, status, subject, body, recipients, cursor_index, total_recipients, sent, failed, skipped, first_error"
          )
          .maybeSingle();
        if (claimErr) {
          console.error("mail-worker claim by id:", claimErr);
          return NextResponse.json({ error: "DB error." }, { status: 500 });
        }
        if (claimed) job = claimed as MailJobRow;
      }
    } else {
      const { data: candidates, error: listErr } = await supabase
        .from("outbound_email_jobs")
        .select(
          "id, status, subject, body, recipients, cursor_index, total_recipients, sent, failed, skipped, first_error"
        )
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true })
        .limit(20);
      if (listErr) {
        console.error("mail-worker list:", listErr);
        return NextResponse.json({ error: "DB error." }, { status: 500 });
      }
      const rows = (candidates ?? []) as MailJobRow[];
      job =
        rows.find(
          (r) =>
            r.status === "pending" ||
            (r.status === "processing" && r.cursor_index < r.total_recipients)
        ) ?? null;
    }

    if (!job) {
      return NextResponse.json({ processed: false, message: "No work." });
    }

    if (job.status === "pending") {
      const { data: claimed, error: claimErr } = await supabase
        .from("outbound_email_jobs")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .select(
          "id, status, subject, body, recipients, cursor_index, total_recipients, sent, failed, skipped, first_error"
        )
        .maybeSingle();
      if (claimErr) {
        console.error("mail-worker claim:", claimErr);
        return NextResponse.json({ error: "DB error." }, { status: 500 });
      }
      if (claimed) {
        job = claimed as MailJobRow;
      } else {
        return NextResponse.json({ processed: false, message: "Job claimed elsewhere." });
      }
    }

    if (job.status !== "processing" || job.cursor_index >= job.total_recipients) {
      return NextResponse.json({
        processed: false,
        jobId: job.id,
        status: job.status,
      });
    }

    const recipients = (Array.isArray(job.recipients)
      ? job.recipients
      : []) as RecipientRow[];
    const batchSize = getWorkerBatchSize();
    const slice = recipients.slice(
      job.cursor_index,
      Math.min(job.cursor_index + batchSize, recipients.length)
    );

    let sent = job.sent;
    let failed = job.failed;
    let firstError = job.first_error;
    const subject = job.subject;
    const messageBody = job.body;

    for (let i = 0; i < slice.length; i++) {
      const row = slice[i];
      const email = String(row.email ?? "")
        .trim()
        .toLowerCase();
      if (!email) continue;
      const greeting = displayNameForRow(email, row.username);
      try {
        await sendBroadcastMessage({
          to: email,
          subject,
          username: greeting,
          messageBody,
        });
        sent++;
      } catch (err) {
        failed++;
        if (!firstError) {
          firstError = err instanceof Error ? err.message : "Send failed.";
        }
      }
      if (i < slice.length - 1) {
        await new Promise((r) => setTimeout(r, ADMIN_BROADCAST_SEND_GAP_MS));
      }
    }

    const nextCursor = job.cursor_index + slice.length;
    const done = nextCursor >= job.total_recipients;
    const now = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("outbound_email_jobs")
      .update({
        cursor_index: nextCursor,
        sent,
        failed,
        first_error: firstError,
        status: done ? "done" : "processing",
        updated_at: now,
        processed_at: done ? now : null,
      })
      .eq("id", job.id);

    if (updErr) {
      console.error("mail-worker update job:", updErr);
      return NextResponse.json({ error: "DB error." }, { status: 500 });
    }

    if (done) {
      const { error: logErr } = await supabase
        .from("admin_mail_log")
        .update({
          sent,
          failed,
          first_error: firstError,
        })
        .eq("job_id", job.id);
      if (logErr) console.error("mail-worker update log:", logErr);
    }

    return NextResponse.json({
      processed: true,
      jobId: job.id,
      status: done ? "done" : "processing",
      cursor_index: nextCursor,
      total_recipients: job.total_recipients,
      sent,
      failed,
    });
  } catch (e) {
    console.error("mail-worker:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
