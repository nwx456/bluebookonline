import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local (use Gmail App Password)."
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Personalized broadcast from admin tooling. Plain text uses DB username as-is;
 * HTML escapes username and body to reduce injection risk.
 */
export async function sendBroadcastMessage(params: {
  to: string;
  subject: string;
  username: string;
  messageBody: string;
}): Promise<void> {
  const { to, subject, username, messageBody } = params;
  const transporter = getTransporter();
  const text = `Hello ${username},\n\n${messageBody}`;
  const safeName = escapeHtml(username);
  const safeBody = escapeHtml(messageBody.replace(/\r\n/g, "\n"))
    .split("\n")
    .join("<br />");
  const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <p>Hello ${safeName},</p>
        <p>${safeBody}</p>
      </div>
    `;
  await transporter.sendMail({
    from: `"Bluebook Online" <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"Bluebook Online" <${GMAIL_USER}>`,
    to,
    subject: "Bluebook Online – Your verification code",
    text: `Your verification code: ${code}. This code is valid for 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <p>Hello,</p>
        <p>Your Bluebook Online verification code:</p>
        <p style="font-size: 24px; letter-spacing: 6px; font-weight: 600; color: #1B365D;">${code}</p>
        <p style="color: #6B7280;">This code is valid for 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}
