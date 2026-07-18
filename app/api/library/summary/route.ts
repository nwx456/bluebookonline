import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { buildLibrarySummary } from "@/lib/library-server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const programParam = new URL(request.url).searchParams.get("program");
    const program = programParam === "SAT" ? "SAT" : "AP";

    const supabase = createServerSupabaseAdmin();
    const summary = await buildLibrarySummary(
      supabase,
      user.email.trim().toLowerCase(),
      program
    );

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[library/summary GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
