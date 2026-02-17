import { NextRequest, NextResponse } from "next/server";
import { generateOtp } from "@/lib/otp-store";
import { sendOtpEmail } from "@/lib/nodemailer";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9]{4,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username } = body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return NextResponse.json(
        { error: "Username must be 4-20 characters, lowercase letters and numbers only." },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    if (!supabaseUrl) {
      console.error("Signup: NEXT_PUBLIC_SUPABASE_URL missing or empty in .env.local");
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is missing or empty in .env.local. Use the exact name, set it to your Supabase project URL (e.g. https://xxx.supabase.co), then restart the dev server (npm run dev)." },
        { status: 500 }
      );
    }
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    if (!serviceRoleKey) {
      console.error("Signup: SUPABASE_SERVICE_ROLE_KEY missing or empty in .env.local");
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is missing or empty. Get it from Supabase Dashboard → Project Settings → API → service_role (secret), add to .env.local, then restart the dev server." },
        { status: 500 }
      );
    }
    const gmailUser = (process.env.GMAIL_USER ?? "").trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD ?? "").trim();
    if (!gmailUser || !gmailPass) {
      console.error("Signup: GMAIL_USER or GMAIL_APP_PASSWORD missing or empty in .env.local");
      return NextResponse.json(
        { error: "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local for sending the 4-digit code (use Gmail App Password). Then restart the dev server." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: existingRow, error: selectError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (selectError) {
      console.error("Signup usertable select error:", selectError);
      return NextResponse.json(
        { error: "Could not check existing account. Please try again later." },
        { status: 500 }
      );
    }

    if (existingRow) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const { data: existingUsernameRow, error: usernameSelectError } = await supabase
      .from("usertable")
      .select("email")
      .ilike("username", normalizedUsername)
      .maybeSingle();

    if (usernameSelectError) {
      console.error("Signup usertable username check error:", usernameSelectError);
      return NextResponse.json(
        { error: "Could not check username. Please try again later." },
        { status: 500 }
      );
    }

    if (existingUsernameRow) {
      return NextResponse.json(
        { error: "This username is already taken." },
        { status: 409 }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertPendingError } = await supabase.from("pending_registrations").upsert(
      { email: normalizedEmail, password_hash: password, code: otp, expires_at: expiresAt, username: normalizedUsername },
      { onConflict: "email" }
    );
    if (insertPendingError) {
      console.error("Signup pending_registrations insert error:", insertPendingError);
      return NextResponse.json(
        { error: "Could not save verification. Please try again." },
        { status: 500 }
      );
    }

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailErr) {
      console.error("Signup sendOtpEmail error:", emailErr);
      return NextResponse.json(
        { error: "Verification email could not be sent. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env.local, or try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code has been sent to your email.",
      email: normalizedEmail,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
