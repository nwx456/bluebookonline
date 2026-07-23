import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-utils";
import { requireAdminUser } from "@/lib/admin-mail-auth";
import { generateUniqueInstitutionJoinCode } from "@/lib/institution-server";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/institutions — List all institutions with counts.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = createServerSupabaseAdmin();
    const { data: institutions, error } = await supabase
      .from("institutions")
      .select("id, owner_email, name, join_code, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("admin/institutions GET:", error);
      return NextResponse.json({ error: "Could not load institutions." }, { status: 500 });
    }

    const institutionIds = (institutions ?? []).map((i) => String(i.id));

    let teacherCounts: Record<string, number> = {};
    let classCounts: Record<string, number> = {};

    if (institutionIds.length > 0) {
      const [{ data: teachers }, { data: classes }] = await Promise.all([
        supabase
          .from("institution_teachers")
          .select("institution_id")
          .in("institution_id", institutionIds)
          .eq("status", "active"),
        supabase
          .from("classes")
          .select("institution_id")
          .in("institution_id", institutionIds)
          .is("archived_at", null),
      ]);

      for (const row of teachers ?? []) {
        const id = String(row.institution_id);
        teacherCounts[id] = (teacherCounts[id] ?? 0) + 1;
      }
      for (const row of classes ?? []) {
        const id = String(row.institution_id);
        classCounts[id] = (classCounts[id] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      institutions: (institutions ?? []).map((inst) => ({
        id: inst.id,
        ownerEmail: inst.owner_email,
        name: inst.name,
        joinCode: inst.join_code,
        status: inst.status,
        createdAt: inst.created_at,
        teacherCount: teacherCounts[String(inst.id)] ?? 0,
        classCount: classCounts[String(inst.id)] ?? 0,
      })),
    });
  } catch (e) {
    console.error("admin/institutions GET:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

/**
 * POST /api/admin/institutions — Create institution account + profile.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.status) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body.email as string);
    const password = typeof body.password === "string" ? body.password : "";
    const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "active";
    const status = statusRaw === "suspended" ? "suspended" : "active";

    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "Institution name is required (max 200 characters)." },
        { status: 400 }
      );
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Valid admin email is required." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: existingUser } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const { data: existingInstitution } = await supabase
      .from("institutions")
      .select("id")
      .eq("owner_email", email)
      .maybeSingle();

    if (existingInstitution) {
      return NextResponse.json(
        { error: "An institution with this email already exists." },
        { status: 409 }
      );
    }

    const joinCode = await generateUniqueInstitutionJoinCode(supabase);
    if (!joinCode) {
      return NextResponse.json(
        { error: "Could not generate a unique join code. Please try again." },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(password);

    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: name },
    });

    if (createAuthError || !authUser.user) {
      console.error("admin/institutions createUser:", createAuthError);
      return NextResponse.json(
        { error: createAuthError?.message ?? "Could not create auth user." },
        { status: 500 }
      );
    }

    const { error: userInsertError } = await supabase.from("usertable").insert({
      email,
      password: passwordHash,
      username: name,
      role: "INSTITUTION",
      age_confirmed_13_plus: true,
    });

    if (userInsertError) {
      console.error("admin/institutions usertable insert:", userInsertError);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: "Could not create institution user." }, { status: 500 });
    }

    const { data: institution, error: instError } = await supabase
      .from("institutions")
      .insert({
        owner_email: email,
        name,
        join_code: joinCode,
        status,
      })
      .select("id, owner_email, name, join_code, status, created_at")
      .single();

    if (instError) {
      console.error("admin/institutions insert:", instError);
      await supabase.from("usertable").delete().eq("email", email);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: "Could not create institution." }, { status: 500 });
    }

    return NextResponse.json({
      institution: {
        id: institution.id,
        ownerEmail: institution.owner_email,
        name: institution.name,
        joinCode: institution.join_code,
        status: institution.status,
        createdAt: institution.created_at,
        teacherCount: 0,
        classCount: 0,
      },
    });
  } catch (e) {
    console.error("admin/institutions POST:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
