import { escapeHtml, sendMail } from "@/lib/mail";

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
  await sendMail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendMail({
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
