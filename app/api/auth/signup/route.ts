import { NextRequest, NextResponse } from "next/server";
import { generateOtp } from "@/lib/otp-store";
import { sendOtpEmail } from "@/lib/nodemailer";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { getMailConfigError } from "@/lib/mail";
import { isValidCountryCode, resolveLegalRegion } from "@/lib/legal/countries";
import { encryptPendingPassword } from "@/lib/pending-registration-crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9]{4,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      username,
      countryCode,
      ageConfirmed13Plus,
      termsAccepted,
      marketingOptIn,
      role: roleRaw,
    } = body;

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

    if (!countryCode || typeof countryCode !== "string" || !isValidCountryCode(countryCode)) {
      return NextResponse.json(
        { error: "A valid country selection is required." },
        { status: 400 }
      );
    }

    if (ageConfirmed13Plus !== true) {
      return NextResponse.json(
        { error: "You must confirm you are at least 13 years old." },
        { status: 400 }
      );
    }

    if (termsAccepted !== true) {
      return NextResponse.json(
        { error: "You must accept the Terms of Service and Privacy Policy." },
        { status: 400 }
      );
    }

    const role =
      typeof roleRaw === "string" && roleRaw.trim().toUpperCase() === "TEACHER"
        ? "TEACHER"
        : "STUDENT";

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    const legalRegion = resolveLegalRegion(countryCode);
    const normalizedCountry = countryCode.trim().toUpperCase() === "OTHER" ? null : countryCode.trim().toUpperCase();

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
    const mailErr = getMailConfigError();
    if (mailErr) {
      console.error("Signup: mail not configured:", mailErr);
      return NextResponse.json(
        {
          error:
            "Email verification is not configured on the server. Set RESEND_API_KEY (recommended), or SMTP_HOST + credentials, or GMAIL_USER + GMAIL_APP_PASSWORD in .env.local. See DOCUMENTATION.md.",
        },
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
        { error: "An account with this email already exists. Sign in or delete your account from Privacy settings." },
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
    let passwordEncrypted: string;
    try {
      passwordEncrypted = encryptPendingPassword(password);
    } catch (encErr) {
      console.error("Signup password encryption error:", encErr);
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const { error: insertPendingError } = await supabase.from("pending_registrations").upsert(
      {
        email: normalizedEmail,
        password_hash: "",
        password_encrypted: passwordEncrypted,
        code: otp,
        expires_at: expiresAt,
        username: normalizedUsername,
        country_code: normalizedCountry,
        legal_region: legalRegion,
        age_confirmed_13_plus: true,
        marketing_opt_in: marketingOptIn === true,
        role,
      },
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
      const isDev = process.env.NODE_ENV !== "production";
      const detail =
        emailErr instanceof Error && isDev
          ? emailErr.message
          : null;
      const hint =
        emailErr instanceof Error &&
        "code" in emailErr &&
        (emailErr as NodeJS.ErrnoException).code === "EAUTH"
          ? " Gmail rejected the credentials (535). Use a @gmail.com or Google Workspace account with a fresh App Password, or switch to Resend/SMTP."
          : "";
      return NextResponse.json(
        {
          error:
            (detail
              ? `Verification email could not be sent: ${detail}.${hint}`
              : "Verification email could not be sent. Check GMAIL_USER and GMAIL_APP_PASSWORD in .env.local, or try Resend/SMTP. See .env.example.") +
            (isDev ? "" : " Please try again later."),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code has been sent to your email.",
      email: normalizedEmail,
      legalRegion,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
