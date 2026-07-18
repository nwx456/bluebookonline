import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { parseLibraryFilters } from "@/lib/library-api-utils";
import { listLibraryAttempts } from "@/lib/library-server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const filters = parseLibraryFilters(new URL(request.url).searchParams);
    const supabase = createServerSupabaseAdmin();
    const attempts = await listLibraryAttempts(
      supabase,
      user.email.trim().toLowerCase(),
      filters
    );

    return NextResponse.json({ attempts });
  } catch (err) {
    console.error("[library/attempts GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
