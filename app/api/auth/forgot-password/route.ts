import { NextRequest, NextResponse } from "next/server";
import { getMailConfigError } from "@/lib/mail";
import { sendPasswordResetEmail } from "@/lib/nodemailer";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_SUCCESS = {
  success: true,
  message: "If an account exists with that email, we've sent a reset link.",
};

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const mailErr = getMailConfigError();
    if (mailErr) {
      console.error("Forgot password: mail not configured:", mailErr);
      return NextResponse.json(
        {
          error:
            "Password reset email is not configured on the server. Set RESEND_API_KEY, or SMTP credentials, or GMAIL_USER + GMAIL_APP_PASSWORD in .env.local.",
        },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Forgot password: Missing Supabase env");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${getBaseUrl()}/reset-password`,
      },
    });

    if (!error && data?.properties?.action_link) {
      try {
        await sendPasswordResetEmail(normalizedEmail, data.properties.action_link);
      } catch (emailErr) {
        console.error("Forgot password sendPasswordResetEmail error:", emailErr);
        return NextResponse.json(
          { error: "Reset email could not be sent. Please try again later." },
          { status: 500 }
        );
      }
    } else if (error) {
      console.log("Forgot password generateLink:", error.message);
    }

    return NextResponse.json(GENERIC_SUCCESS);
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Password reset request failed. Please try again." },
      { status: 500 }
    );
  }
}
