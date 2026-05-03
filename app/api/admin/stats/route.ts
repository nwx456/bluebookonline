import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { SUBJECT_KEYS, SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token)
    return { user: null, error: "Authentication required. Please sign in again." };
  const supabase = createServerSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user?.email)
    return {
      user: null,
      error: "Invalid or expired session. Please sign in again.",
    };
  return { user, error: null };
}

/**
 * GET /api/admin/stats
 * Aggregate site metrics for admin dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized." }, { status: 401 });
    }
    if (!isAdminBroadcastEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const supabase = createServerSupabaseAdmin();

    const [
      usersRes,
      pendingRes,
      pdfTotalRes,
      pdfPublishedRes,
      pdfUnpublishedRes,
      questionsRes,
      questionsGraphRes,
      attemptsRes,
      attemptsCompletedRes,
      attemptsInProgressRes,
      answersRes,
      ...subjectCountResults
    ] = await Promise.all([
      supabase.from("usertable").select("*", { count: "exact", head: true }),
      supabase.from("pending_registrations").select("*", { count: "exact", head: true }),
      supabase.from("pdf_uploads").select("*", { count: "exact", head: true }),
      supabase.from("pdf_uploads").select("*", { count: "exact", head: true }).eq("is_published", true),
      supabase
        .from("pdf_uploads")
        .select("*", { count: "exact", head: true })
        .or("is_published.eq.false,is_published.is.null"),
      supabase.from("questions").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("*", { count: "exact", head: true }).eq("has_graph", true),
      supabase.from("attempts").select("*", { count: "exact", head: true }),
      supabase.from("attempts").select("*", { count: "exact", head: true }).not("completed_at", "is", null),
      supabase.from("attempts").select("*", { count: "exact", head: true }).is("completed_at", null),
      supabase.from("attempt_answers").select("*", { count: "exact", head: true }),
      ...SUBJECT_KEYS.map((subject: SubjectKey) =>
        supabase.from("pdf_uploads").select("*", { count: "exact", head: true }).eq("subject", subject)
      ),
    ]);

    const checks = [
      usersRes,
      pendingRes,
      pdfTotalRes,
      pdfPublishedRes,
      pdfUnpublishedRes,
      questionsRes,
      questionsGraphRes,
      attemptsRes,
      attemptsCompletedRes,
      attemptsInProgressRes,
      answersRes,
      ...subjectCountResults,
    ];

    const firstErr = checks.find((r) => r.error);
    if (firstErr?.error) {
      console.error("admin/stats:", firstErr.error);
      return NextResponse.json({ error: "Could not load statistics." }, { status: 500 });
    }

    const pdfBySubject = SUBJECT_KEYS.map((subject, i) => {
      const count = subjectCountResults[i]?.count ?? 0;
      return {
        subject,
        label: SUBJECT_LABELS[subject],
        pdfCount: count ?? 0,
      };
    })
      .filter((s) => s.pdfCount > 0)
      .sort((a, b) => b.pdfCount - a.pdfCount);

    return NextResponse.json({
      registeredUsers: usersRes.count ?? 0,
      pendingRegistrations: pendingRes.count ?? 0,
      pdfUploadsTotal: pdfTotalRes.count ?? 0,
      pdfPublished: pdfPublishedRes.count ?? 0,
      pdfUnpublished: pdfUnpublishedRes.count ?? 0,
      questionsTotal: questionsRes.count ?? 0,
      questionsWithGraph: questionsGraphRes.count ?? 0,
      attemptsTotal: attemptsRes.count ?? 0,
      attemptsCompleted: attemptsCompletedRes.count ?? 0,
      attemptsInProgress: attemptsInProgressRes.count ?? 0,
      attemptAnswersTotal: answersRes.count ?? 0,
      pdfBySubject,
    });
  } catch (e) {
    console.error("admin/stats:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
