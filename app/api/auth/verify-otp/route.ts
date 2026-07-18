import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth-utils";
import { getClientIp } from "@/lib/auth-session";
import { recordSignupConsents } from "@/lib/legal/consent";
import { resolvePendingPassword } from "@/lib/pending-registration-crypto";
import type { LegalRegion } from "@/lib/legal/countries";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || typeof email !== "string" || !code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim().replace(/\s/g, "");
    if (!/^\d{4}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Verification code must be 4 digits." },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Verify OTP: Missing Supabase env");
      return NextResponse.json(
        { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase Dashboard → Settings → API → service_role)." },
        { status: 500 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: row, error: fetchError } = await supabase
      .from("pending_registrations")
      .select(
        "email, password_hash, password_encrypted, code, expires_at, username, country_code, legal_region, age_confirmed_13_plus, marketing_opt_in, role"
      )
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }
    if (new Date(row.expires_at) < new Date()) {
      await supabase.from("pending_registrations").delete().eq("email", normalizedEmail);
      return NextResponse.json(
        { error: "Verification code expired. Request a new one." },
        { status: 400 }
      );
    }
    if (String(row.code).trim() !== normalizedCode) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    if (row.age_confirmed_13_plus !== true) {
      return NextResponse.json(
        { error: "Age confirmation missing. Please sign up again." },
        { status: 400 }
      );
    }

    const password = resolvePendingPassword(row);
    if (!password) {
      return NextResponse.json(
        { error: "Registration data corrupted. Please sign up again." },
        { status: 400 }
      );
    }

    const username = row.username ?? null;
    const countryCode = (row.country_code as string | null) ?? null;
    const legalRegion = (row.legal_region as LegalRegion) ?? "ROW";
    const marketingOptIn = row.marketing_opt_in === true;
    const role = row.role === "TEACHER" ? "TEACHER" : "STUDENT";

    await supabase.from("pending_registrations").delete().eq("email", normalizedEmail);
    const pending = { email: normalizedEmail, password, username };

    let authData: { user?: { id: string; email?: string } } | null = null;

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
      user_metadata: pending.username ? { username: pending.username } : undefined,
    });

    if (createError) {
      const isAlreadyExists =
        createError.message?.includes("already been registered") || createError.message?.includes("already exists");
      if (isAlreadyExists) {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === pending.email);
        if (existingUser?.id) {
          await supabase.auth.admin.deleteUser(existingUser.id);
        }
        await supabase.from("attempts").delete().eq("user_email", pending.email);
        await supabase.from("pdf_uploads").delete().eq("user_email", pending.email);
        await supabase.from("usertable").delete().eq("email", pending.email);
        const { data: retryData, error: retryError } = await supabase.auth.admin.createUser({
          email: pending.email,
          password: pending.password,
          email_confirm: true,
          user_metadata: pending.username ? { username: pending.username } : undefined,
        });
        if (retryError) {
          console.error("Verify OTP retry createUser error:", retryError);
          return NextResponse.json(
            { error: "Account could not be created. Please try again." },
            { status: 500 }
          );
        }
        authData = retryData;
      } else {
        console.error("Verify OTP Supabase createUser error:", createError);
        return NextResponse.json(
          { error: "Account could not be created. Please try again." },
          { status: 500 }
        );
      }
    } else {
      authData = createData;
    }

    const passwordHash = await hashPassword(pending.password);
    const { error: tableError } = await supabase.from("usertable").insert({
      email: pending.email,
      password: passwordHash,
      ...(pending.username && { username: pending.username }),
      country_code: countryCode,
      legal_region: legalRegion,
      age_confirmed_13_plus: true,
      marketing_opt_in: marketingOptIn,
      role,
    });

    if (tableError) {
      console.error("Verify OTP usertable insert error:", tableError);
      const authUserId = authData?.user?.id;
      if (authUserId) {
        await supabase.auth.admin.deleteUser(authUserId);
      }
      const isUsernameTaken =
        tableError.code === "23505" && String(tableError.message).includes("username");
      return NextResponse.json(
        { error: isUsernameTaken ? "This username was taken by another user. Please sign up again with a different username." : "Profile could not be saved. Please try again." },
        { status: isUsernameTaken ? 409 : 500 }
      );
    }

    const { error: consentError } = await recordSignupConsents(supabase, {
      userEmail: pending.email,
      legalRegion,
      marketingOptIn,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    if (consentError) {
      console.error("Verify OTP consent error:", consentError);
    }

    return NextResponse.json({
      success: true,
      message: "Account created. You can sign in now.",
      user: authData?.user ? { id: authData.user.id, email: authData.user.email } : undefined,
      legalRegion,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
