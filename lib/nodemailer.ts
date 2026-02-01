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
