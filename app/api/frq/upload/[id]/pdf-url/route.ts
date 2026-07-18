import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { canAccessFrqUpload } from "@/lib/frq-server";
import { createSignedPdfUrl } from "@/lib/signed-pdf-url";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/frq/upload/[id]/pdf-url — Signed PDF URL for FRQ exam takers (Show page, graph fallback).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthUser(request);
    if (!auth.user?.email) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Upload ID is required." }, { status: 400 });
    }

    const email = auth.user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();

    const allowed = await canAccessFrqUpload(supabase, id, email);
    if (!allowed) {
      return NextResponse.json({ error: "FRQ exam not found or access denied." }, { status: 403 });
    }

    const { data: upload, error: fetchError } = await supabase
      .from("frq_uploads")
      .select("id, storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: "FRQ exam not found." }, { status: 404 });
    }

    const { url, error: signErr } = await createSignedPdfUrl(
      supabase,
      upload.id as string,
      upload.storage_path as string | null
    );

    if (signErr || !url) {
      return NextResponse.json(
        { error: signErr ?? "Could not generate PDF link. Please try again." },
        { status: 404 }
      );
    }

    return NextResponse.json({ pdfUrl: url });
  } catch (err) {
    console.error("[frq/upload/pdf-url GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
