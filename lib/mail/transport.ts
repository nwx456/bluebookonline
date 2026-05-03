import nodemailer from "nodemailer";
import { getFormattedFromAddress, resolveMailProvider } from "./from-address";
import { withSendRetry } from "./retry";

export type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
};

async function sendViaResend(payload: SendMailPayload, from: string): Promise<void> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      headers: payload.headers && Object.keys(payload.headers).length ? payload.headers : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof (body as { message?: string }).message === "string"
        ? (body as { message: string }).message
        : res.statusText;
    const err = new Error(`Resend: ${msg}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
}

function smtpTransport() {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASS ?? "").trim();
  const secure =
    (process.env.SMTP_SECURE ?? "").trim().toLowerCase() === "true" || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
}

async function sendViaSmtp(payload: SendMailPayload, from: string): Promise<void> {
  const transporter = smtpTransport();
  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: payload.headers,
  });
}

async function sendViaGmail(payload: SendMailPayload, from: string): Promise<void> {
  const user = (process.env.GMAIL_USER ?? "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").trim();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: payload.headers,
  });
}

async function dispatchOnce(payload: SendMailPayload): Promise<void> {
  const from = getFormattedFromAddress();
  const provider = resolveMailProvider();
  switch (provider) {
    case "resend":
      return sendViaResend(payload, from);
    case "smtp":
      return sendViaSmtp(payload, from);
    case "gmail":
      return sendViaGmail(payload, from);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/**
 * Low-level send with transient error retries (all providers).
 */
export async function sendMail(payload: SendMailPayload): Promise<void> {
  return withSendRetry(() => dispatchOnce(payload), 2);
}
