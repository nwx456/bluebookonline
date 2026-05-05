import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

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
 * GET /api/exams/in-progress
 * Lists the user's incomplete exam attempts (completed_at is null).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json(
        { error: authError ?? "Unauthorized" },
        { status: 401 }
      );
    }
    const userEmail = user.email.trim().toLowerCase();

    const supabase = createServerSupabaseAdmin();

    const { data: attempts, error: attemptsError } = await supabase
      .from("attempts")
      .select("id, upload_id, started_at, time_spent_seconds")
      .eq("user_email", userEmail)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(20);

    if (attemptsError) {
      console.error("In-progress attempts fetch error:", attemptsError);
      return NextResponse.json(
        { error: "Failed to fetch in-progress exams." },
        { status: 500 }
      );
    }

    const list = attempts ?? [];
    if (list.length === 0) {
      return NextResponse.json({ attempts: [] });
    }

    const uploadIds = [...new Set(list.map((a) => a.upload_id))];
    const { data: uploads } = await supabase
      .from("pdf_uploads")
      .select("id, filename, subject")
      .in("id", uploadIds);

    const uploadMap = new Map(
      (uploads ?? []).map((u) => [
        u.id,
        { filename: u.filename ?? "PDF", subject: u.subject ?? "AP_CSA" },
      ])
    );

    const result = list.map((a) => {
      const u = uploadMap.get(a.upload_id);
      return {
        id: a.id,
        uploadId: a.upload_id,
        filename: u?.filename ?? "PDF",
        subject: u?.subject ?? "AP_CSA",
        startedAt: a.started_at,
        timeSpentSeconds: a.time_spent_seconds ?? 0,
      };
    });

    return NextResponse.json({ attempts: result });
  } catch (err) {
    console.error("In-progress exams error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
