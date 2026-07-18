import { escapeHtml, sendMail } from "@/lib/mail";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

function emailLogoHtml(baseUrl: string): string {
  const logoUrl = `${baseUrl}/logo.png`;
  return `<p style="margin: 0 0 24px;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(SITE_NAME)}" width="200" style="max-width: 100%; height: auto;" /></p>`;
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
  const baseUrl = getSiteUrl();
  const unsubscribeUrl = `${baseUrl}/settings/privacy`;
  const text = `Hello ${username},\n\n${messageBody}\n\n---\nUnsubscribe from marketing emails: ${unsubscribeUrl}`;
  const safeName = escapeHtml(username);
  const safeBody = escapeHtml(messageBody.replace(/\r\n/g, "\n"))
    .split("\n")
    .join("<br />");
  const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <p>Hello ${safeName},</p>
        <p>${safeBody}</p>
        <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
          <a href="${unsubscribeUrl}">Unsubscribe</a> from marketing emails.
        </p>
      </div>
    `;
  await sendMail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const safeLink = escapeHtml(resetLink);
  const baseUrl = getSiteUrl();
  await sendMail({
    to,
    subject: `${SITE_NAME} – Reset your password`,
    text: `Reset your ${SITE_NAME} password using this link (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        ${emailLogoHtml(baseUrl)}
        <p>Hello,</p>
        <p>We received a request to reset your ${SITE_NAME} password.</p>
        <p style="margin: 24px 0;">
          <a href="${safeLink}" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
            Reset password
          </a>
        </p>
        <p style="color: #6B7280; font-size: 14px;">This link is valid for 1 hour.</p>
        <p style="color: #6B7280; font-size: 14px;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const baseUrl = getSiteUrl();
  await sendMail({
    to,
    subject: `${SITE_NAME} – Your verification code`,
    text: `Your verification code: ${code}. This code is valid for 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        ${emailLogoHtml(baseUrl)}
        <p>Hello,</p>
        <p>Your ${SITE_NAME} verification code:</p>
        <p style="font-size: 24px; letter-spacing: 6px; font-weight: 600; color: #1B365D;">${code}</p>
        <p style="color: #6B7280;">This code is valid for 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}
