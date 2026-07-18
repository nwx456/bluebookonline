import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import {
  createEntityTag,
  listUsedLibraryTags,
  replaceEntityTags,
} from "@/lib/library-server";
import type { LibraryEntityType } from "@/lib/library-types";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

const TAG_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

function pickTagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();
    const usedOnly = new URL(request.url).searchParams.get("usedOnly") === "true";

    if (usedOnly) {
      const tags = await listUsedLibraryTags(supabase, userEmail);
      return NextResponse.json({ tags });
    }

    const { data, error } = await supabase
      .from("user_library_tags")
      .select("id, name, color, created_at")
      .eq("user_email", userEmail)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tags: (data ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        createdAt: tag.created_at,
      })),
    });
  } catch (err) {
    console.error("[library/tags GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { name?: string; color?: string | null };
    const name = body.name?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
    }
    if (name.length > 40) {
      return NextResponse.json({ error: "Tag name must be 40 characters or fewer." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const userEmail = user.email.trim().toLowerCase();
    const color = body.color?.trim() || pickTagColor(name);

    const { data, error } = await supabase
      .from("user_library_tags")
      .insert({ user_email: userEmail, name, color })
      .select("id, name, color, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This tag name is already used on another exam — pick a different name." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tag: {
        id: data.id,
        name: data.name,
        color: data.color,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    console.error("[library/tags POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string; name?: string; color?: string | null };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Tag ID is required." }, { status: 400 });
    }

    const updates: Record<string, string | null> = {};
    if (body.name != null) {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "Tag name cannot be empty." }, { status: 400 });
      updates.name = name;
    }
    if ("color" in body) {
      updates.color = body.color?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("user_library_tags")
      .update(updates)
      .eq("id", id)
      .eq("user_email", user.email.trim().toLowerCase())
      .select("id, name, color, created_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This tag name is already used on another exam — pick a different name." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });
    }

    return NextResponse.json({
      tag: {
        id: data.id,
        name: data.name,
        color: data.color,
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    console.error("[library/tags PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Tag ID is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();
    const { error } = await supabase
      .from("user_library_tags")
      .delete()
      .eq("id", id)
      .eq("user_email", user.email.trim().toLowerCase());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[library/tags DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
