import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateClassCode,
  isValidClassCodeFormat,
  normalizeClassCode,
} from "@/lib/class-code";
import { normalizeEmail } from "@/lib/moderator-auth";

export type InstitutionRow = {
  id: string;
  owner_email: string;
  name: string;
  join_code: string;
  status: "active" | "suspended";
  created_at: string;
};

export type InstitutionTeacherStatus = "pending" | "active" | "removed";

export async function generateUniqueInstitutionJoinCode(
  supabase: SupabaseClient,
  maxAttempts = 10
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateClassCode();
    const { data: instMatch } = await supabase
      .from("institutions")
      .select("id")
      .eq("join_code", code)
      .maybeSingle();
    if (instMatch) continue;

    const { data: classMatch } = await supabase
      .from("classes")
      .select("id")
      .eq("class_code", code)
      .maybeSingle();
    if (!classMatch) return code;
  }
  return null;
}

export async function getInstitutionByOwner(
  supabase: SupabaseClient,
  ownerEmail: string
): Promise<InstitutionRow | null> {
  const { data, error } = await supabase
    .from("institutions")
    .select("id, owner_email, name, join_code, status, created_at")
    .eq("owner_email", normalizeEmail(ownerEmail))
    .maybeSingle();

  if (error) {
    console.error("getInstitutionByOwner error:", error);
    return null;
  }
  return (data as InstitutionRow | null) ?? null;
}

export async function getInstitutionById(
  supabase: SupabaseClient,
  institutionId: string
): Promise<InstitutionRow | null> {
  const { data, error } = await supabase
    .from("institutions")
    .select("id, owner_email, name, join_code, status, created_at")
    .eq("id", institutionId)
    .maybeSingle();

  if (error) {
    console.error("getInstitutionById error:", error);
    return null;
  }
  return (data as InstitutionRow | null) ?? null;
}

export async function findInstitutionByJoinCode(
  supabase: SupabaseClient,
  rawCode: string
): Promise<InstitutionRow | null> {
  const code = normalizeClassCode(rawCode);
  if (!isValidClassCodeFormat(code)) return null;

  const { data, error } = await supabase
    .from("institutions")
    .select("id, owner_email, name, join_code, status, created_at")
    .eq("join_code", code)
    .maybeSingle();

  if (error) {
    console.error("findInstitutionByJoinCode error:", error);
    return null;
  }
  return (data as InstitutionRow | null) ?? null;
}

export async function isActiveInstitutionTeacher(
  supabase: SupabaseClient,
  institutionId: string,
  teacherEmail: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("institution_teachers")
    .select("status")
    .eq("institution_id", institutionId)
    .eq("teacher_email", normalizeEmail(teacherEmail))
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("isActiveInstitutionTeacher error:", error);
    return false;
  }
  return Boolean(data);
}

export async function getInstitutionNamesByIds(
  supabase: SupabaseClient,
  institutionIds: string[]
): Promise<Record<string, string>> {
  if (institutionIds.length === 0) return {};
  const { data, error } = await supabase
    .from("institutions")
    .select("id, name")
    .in("id", institutionIds);

  if (error) {
    console.error("getInstitutionNamesByIds error:", error);
    return {};
  }

  return Object.fromEntries(
    (data ?? []).map((row) => [String(row.id), row.name as string])
  );
}
