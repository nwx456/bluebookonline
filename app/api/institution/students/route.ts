import { NextRequest, NextResponse } from "next/server";
import { requireInstitutionUser } from "@/lib/institution-auth";
import { normalizeEmail } from "@/lib/moderator-auth";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionUser(request);
  if (auth.status) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const institutionId = auth.institution!.id;
  const supabase = createServerSupabaseAdmin();

  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("institution_id", institutionId)
    .is("archived_at", null);

  const classIds = (classes ?? []).map((c) => String(c.id));
  if (classIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  const { data: members, error } = await supabase
    .from("class_members")
    .select("student_email, class_id, joined_at")
    .in("class_id", classIds)
    .order("joined_at", { ascending: false });

  if (error) {
    console.error("institution/students GET:", error);
    return NextResponse.json({ error: "Could not load students." }, { status: 500 });
  }

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);

  const classNames = Object.fromEntries(
    (classRows ?? []).map((c) => [String(c.id), c.name as string])
  );

  const studentMap = new Map<
    string,
    { email: string; classIds: string[]; classNames: string[]; latestJoinedAt: string }
  >();

  for (const row of members ?? []) {
    const email = normalizeEmail(row.student_email as string);
    const cid = String(row.class_id);
    const existing = studentMap.get(email);
    if (existing) {
      if (!existing.classIds.includes(cid)) {
        existing.classIds.push(cid);
        existing.classNames.push(classNames[cid] ?? "Class");
      }
      if (String(row.joined_at) > existing.latestJoinedAt) {
        existing.latestJoinedAt = String(row.joined_at);
      }
    } else {
      studentMap.set(email, {
        email,
        classIds: [cid],
        classNames: [classNames[cid] ?? "Class"],
        latestJoinedAt: String(row.joined_at),
      });
    }
  }

  const emails = [...studentMap.keys()];
  const { data: users } = await supabase
    .from("usertable")
    .select("email, username")
    .in("email", emails.length ? emails : ["__none__"]);

  const nameMap = Object.fromEntries(
    (users ?? []).map((u) => [
      normalizeEmail(u.email as string),
      (u.username as string | null)?.trim() || u.email?.split("@")[0] || "Student",
    ])
  );

  return NextResponse.json({
    students: [...studentMap.values()]
      .sort((a, b) => b.latestJoinedAt.localeCompare(a.latestJoinedAt))
      .map((s) => ({
        email: s.email,
        username: nameMap[s.email] ?? s.email.split("@")[0],
        classCount: s.classIds.length,
        classNames: s.classNames,
        latestJoinedAt: s.latestJoinedAt,
      })),
  });
}
