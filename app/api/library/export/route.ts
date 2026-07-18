import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { parseLibraryFilters } from "@/lib/library-api-utils";
import { attemptsToCsv, listLibraryAttempts, listLibraryUploads } from "@/lib/library-server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    const filters = parseLibraryFilters(url.searchParams);
    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();

    const [attempts, uploads] = await Promise.all([
      listLibraryAttempts(supabase, userEmail, filters),
      listLibraryUploads(supabase, userEmail, filters),
    ]);

    if (format === "csv") {
      const csv = attemptsToCsv(attempts);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="exam-library-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      attempts,
      uploads,
    });
  } catch (err) {
    console.error("[library/export GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
