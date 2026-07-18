import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { buildLibraryInsights } from "@/lib/library-server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const programParam = new URL(request.url).searchParams.get("program");
    const program =
      programParam === "AP" || programParam === "SAT" ? programParam : undefined;

    const supabase = createServerSupabaseAdmin();
    const insights = await buildLibraryInsights(
      supabase,
      user.email.trim().toLowerCase(),
      program
    );

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[library/insights GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
