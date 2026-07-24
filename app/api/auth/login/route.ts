import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolvePostAuthPath } from "@/lib/post-login-redirect";
import { isDemoLoginAlias, resolveDemoLoginEmail } from "@/lib/demo-login";
import { logServerError } from "@/lib/error-logging";

export async function POST(request: NextRequest) {
  let loginEmail: string | null = null;
  try {
    const body = await request.json();
    const { email, password, next } = body;
    if (typeof email === "string") loginEmail = email.trim().toLowerCase();

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Login: Missing Supabase env");
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const demoEmail = resolveDemoLoginEmail(email, password);
    if (isDemoLoginAlias(email) && !demoEmail) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const authEmail = demoEmail ?? email.trim().toLowerCase();

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      if (error.message?.includes("Invalid login credentials") || error.message === "invalid_credentials") {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: error.message || "Sign in failed." },
        { status: 401 }
      );
    }

    const redirectPath = await resolvePostAuthPath(
      authEmail,
      typeof next === "string" ? next : null
    );

    return NextResponse.json({
      success: true,
      redirectPath,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
      user: data.user ? { id: data.user.id, email: data.user.email } : undefined,
    });
  } catch (err) {
    void logServerError(err, {
      request,
      endpoint: "/api/auth/login",
      user: loginEmail ? { email: loginEmail } : null,
    });
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Sign in failed. Please try again." },
      { status: 500 }
    );
  }
}
