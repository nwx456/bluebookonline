/**
 * Quick outbound mail smoke test.
 * Usage: npm run test:mail -- you@example.com
 */
import { config } from "dotenv";
import nodemailer from "nodemailer";

config({ path: ".env.local" });
config({ path: ".env" });

const to = process.argv[2]?.trim();
if (!to) {
  console.error("Usage: npm run test:mail -- recipient@example.com");
  process.exit(1);
}

const provider = (process.env.MAIL_PROVIDER ?? "").trim().toLowerCase();
const resendKey = (process.env.RESEND_API_KEY ?? "").trim();
const smtpHost = (process.env.SMTP_HOST ?? "").trim();
const gmailUser = (process.env.GMAIL_USER ?? "").trim();
const gmailPass = (process.env.GMAIL_APP_PASSWORD ?? "").trim().replace(/\s+/g, "");

let mode = provider;
if (!mode) {
  if (resendKey) mode = "resend";
  else if (smtpHost) mode = "smtp";
  else if (gmailUser && gmailPass) mode = "gmail";
  else mode = "none";
}

const fromName = (process.env.MAIL_FROM_NAME ?? "AP Practice Exam Online").trim();
const modeResolved = mode === "gmail" ? "gmail" : mode;
const fromEmail =
  modeResolved === "gmail"
    ? (process.env.GMAIL_USER ?? "").trim()
    : (
        process.env.MAIL_FROM_EMAIL ??
        process.env.GMAIL_USER ??
        "info@apracticexamonline.com"
      ).trim();
const from = `"${fromName}" <${fromEmail}>`;

console.log("Mail provider:", mode);
console.log("From:", from);
console.log("To:", to);

try {
  if (mode === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Mail test – AP Practice Exam Online",
        text: "If you received this, outbound mail is configured correctly.",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? res.statusText);
    }
    console.log("OK – Resend accepted the message.");
    process.exit(0);
  }

  if (mode === "gmail") {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from,
      to,
      subject: "Mail test – AP Practice Exam Online",
      text: "If you received this, Gmail SMTP is configured correctly.",
    });
    console.log("OK – Gmail SMTP sent the message.");
    process.exit(0);
  }

  if (mode === "smtp") {
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const user = (process.env.SMTP_USER ?? "").trim();
    const pass = (process.env.SMTP_PASS ?? "").trim();
    const secure =
      (process.env.SMTP_SECURE ?? "").trim().toLowerCase() === "true" || port === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    await transporter.sendMail({
      from,
      to,
      subject: "Mail test – AP Practice Exam Online",
      text: "If you received this, SMTP is configured correctly.",
    });
    console.log("OK – SMTP sent the message.");
    process.exit(0);
  }

  console.error(
    "No mail provider configured. Set RESEND_API_KEY, SMTP_HOST, or GMAIL_USER + GMAIL_APP_PASSWORD."
  );
  process.exit(1);
} catch (err) {
  console.error("FAIL –", err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "code" in err && err.code === "EAUTH") {
    console.error(
      "\nHint: Gmail rejected credentials (535). Use a @gmail.com or Google Workspace account with a fresh App Password (2FA required)."
    );
  }
  process.exit(1);
}
