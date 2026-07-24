/**
 * Seed demo accounts for Teacher, Institution, and Student roles.
 * Run: npm run seed:demo-users
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const DEMO_DOMAIN = "demo.bluebookonline.local";

const DEMO_USERS = [
  {
    username: "teacher",
    password: "teacher123",
    role: "TEACHER",
    displayName: "Teacher",
  },
  {
    username: "institutions",
    password: "institutions123",
    role: "INSTITUTION",
    displayName: "Institutions",
    institutionName: "Demo Institution",
  },
  {
    username: "student",
    password: "student123",
    role: "STUDENT",
    displayName: "Student",
  },
];

const JOIN_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function demoEmail(username) {
  return `${username}@${DEMO_DOMAIN}`;
}

function generateJoinCode(length = 8) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_CHARSET[randomInt(0, JOIN_CODE_CHARSET.length)];
  }
  return code;
}

async function generateUniqueJoinCode(supabase) {
  for (let i = 0; i < 20; i++) {
    const code = generateJoinCode();
    const [{ data: instMatch }, { data: classMatch }] = await Promise.all([
      supabase.from("institutions").select("id").eq("join_code", code).maybeSingle(),
      supabase.from("classes").select("id").eq("class_code", code).maybeSingle(),
    ]);
    if (!instMatch && !classMatch) return code;
  }
  throw new Error("Could not generate a unique join code.");
}

async function findAuthUserByEmail(supabase, email) {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      console.warn(`[seed:demo] listUsers failed for ${email}: ${error.message}`);
      return null;
    }
    return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch (err) {
    console.warn(`[seed:demo] listUsers unavailable for ${email}:`, err?.message ?? err);
    return null;
  }
}

async function ensureAuthUser(supabase, supabaseUrl, anonKey, demo, email, hasProfile) {
  if (hasProfile && anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password: demo.password,
    });
    if (signInData?.user && !signInError) {
      console.log(`[seed:demo] auth user verified: ${demo.username}`);
      return signInData.user;
    }
  }

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: demo.password,
    email_confirm: true,
    user_metadata: { username: demo.username },
  });

  if (!createError && createData.user) {
    console.log(`[seed:demo] created auth user: ${demo.username}`);
    return createData.user;
  }

  const alreadyExists =
    createError?.message?.includes("already been registered") ||
    createError?.message?.includes("already exists") ||
    createError?.message?.includes("duplicate");

  if (alreadyExists) {
    const authUser = await findAuthUserByEmail(supabase, email);
    if (authUser) {
      try {
        const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
          password: demo.password,
          email_confirm: true,
          user_metadata: { username: demo.username },
        });
        if (updateError) throw updateError;
        console.log(`[seed:demo] updated existing auth user: ${demo.username}`);
        return authUser;
      } catch (updateErr) {
        if (anonKey) {
          const anonClient = createClient(supabaseUrl, anonKey);
          const { data: signInData } = await anonClient.auth.signInWithPassword({
            email,
            password: demo.password,
          });
          if (signInData?.user) {
            console.log(`[seed:demo] auth user verified after update failure: ${demo.username}`);
            return signInData.user;
          }
        }
        throw updateErr;
      }
    }
  }

  throw createError ?? new Error(`Could not create auth user for ${demo.username}`);
}

async function freeDemoUsername(supabase, username, demoEmail) {
  const { data: conflict } = await supabase
    .from("usertable")
    .select("email, username")
    .ilike("username", username)
    .maybeSingle();

  if (!conflict?.email) return;
  if (conflict.email.toLowerCase() === demoEmail.toLowerCase()) return;

  const fallbackUsername = `${username}${Date.now().toString(36).slice(-4)}`;
  const { error } = await supabase
    .from("usertable")
    .update({ username: fallbackUsername })
    .eq("email", conflict.email);
  if (error) throw error;
  console.log(
    `[seed:demo] renamed conflicting username "${username}" on ${conflict.email} → ${fallbackUsername}`
  );
}

async function upsertDemoUser(supabase, supabaseUrl, anonKey, demo) {
  const email = demoEmail(demo.username);
  const passwordHash = await bcrypt.hash(demo.password, 10);

  await freeDemoUsername(supabase, demo.username, email);

  const { data: existingRow } = await supabase
    .from("usertable")
    .select("email, username, role")
    .eq("email", email)
    .maybeSingle();

  let authUser = await ensureAuthUser(
    supabase,
    supabaseUrl,
    anonKey,
    demo,
    email,
    Boolean(existingRow)
  );

  if (existingRow) {
    const { error: updateError } = await supabase
      .from("usertable")
      .update({
        username: demo.username,
        password: passwordHash,
        role: demo.role,
        age_confirmed_13_plus: true,
        legal_region: "ROW",
      })
      .eq("email", email);
    if (updateError) throw updateError;
    console.log(`[seed:demo] updated usertable row: ${demo.username} (${demo.role})`);
  } else {
    const { error: insertError } = await supabase.from("usertable").insert({
      email,
      password: passwordHash,
      username: demo.username,
      role: demo.role,
      age_confirmed_13_plus: true,
      legal_region: "ROW",
    });
    if (insertError) throw insertError;
    console.log(`[seed:demo] created usertable row: ${demo.username} (${demo.role})`);
  }

  if (demo.role === "INSTITUTION") {
    const institutionName =
      "institutionName" in demo && demo.institutionName
        ? demo.institutionName
        : demo.displayName;

    const { data: existingInstitution } = await supabase
      .from("institutions")
      .select("id, join_code")
      .eq("owner_email", email)
      .maybeSingle();

    if (existingInstitution) {
      const { error: updateError } = await supabase
        .from("institutions")
        .update({ name: institutionName, status: "active" })
        .eq("id", existingInstitution.id);
      if (updateError) throw updateError;
      console.log(
        `[seed:demo] updated institution profile (join code: ${existingInstitution.join_code})`
      );
    } else {
      const joinCode = await generateUniqueJoinCode(supabase);
      const { error: insertError } = await supabase.from("institutions").insert({
        owner_email: email,
        name: institutionName,
        join_code: joinCode,
        status: "active",
      });
      if (insertError) throw insertError;
      console.log(`[seed:demo] created institution profile (join code: ${joinCode})`);
    }
  }

  return { username: demo.username, email, role: demo.role, authUserId: authUser.id };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[seed:demo] Seeding demo users...");
  const results = [];
  for (const demo of DEMO_USERS) {
    results.push(await upsertDemoUser(supabase, supabaseUrl, anonKey ?? "", demo));
  }

  console.log("\n[seed:demo] Done. Demo login credentials:");
  for (const demo of DEMO_USERS) {
    console.log(`  ${demo.username} / ${demo.password} (${demo.role})`);
  }
  console.log(`\n  Login at /login with username + password (emails use @${DEMO_DOMAIN}).`);
  return results;
}

main().catch((err) => {
  console.error("[seed:demo] failed:", err);
  process.exit(1);
});
