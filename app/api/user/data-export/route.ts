import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { getLatestConsents } from "@/lib/legal/consent";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user?.email) {
    return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  const supabase = createServerSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from("usertable")
    .select("email, username, country_code, legal_region, marketing_opt_in, created_at")
    .eq("email", email)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const { data: uploads } = await supabase
    .from("pdf_uploads")
    .select("id, filename, subject, exam_program, created_at, is_published")
    .eq("user_email", email);

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, upload_id, score, total_questions, completed_at, created_at")
    .eq("user_email", email);

  const uploadIds = (uploads ?? []).map((u) => u.id as string);
  let answers: unknown[] = [];
  const attemptIds = (attempts ?? []).map((a) => a.id as string);
  if (attemptIds.length) {
    const { data: answerRows } = await supabase
      .from("attempt_answers")
      .select("attempt_id, question_id, user_answer, is_correct, is_flagged")
      .in("attempt_id", attemptIds);
    answers = answerRows ?? [];
  }

  let questions: unknown[] = [];
  if (uploadIds.length) {
    const { data: questionRows } = await supabase
      .from("questions")
      .select("id, upload_id, question_number, question_text, correct_answer")
      .in("upload_id", uploadIds);
    questions = questionRows ?? [];
  }

  const consents = await getLatestConsents(supabase, email);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile,
    consents,
    pdf_uploads: uploads ?? [],
    attempts: attempts ?? [],
    attempt_answers: answers,
    questions,
  });
}
