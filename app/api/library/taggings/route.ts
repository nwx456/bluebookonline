import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-session";
import {
  createEntityTag,
  removeEntityTag,
  replaceEntityTags,
} from "@/lib/library-server";
import type { LibraryEntityType } from "@/lib/library-types";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

async function assertEntityOwnership(
  supabase: ReturnType<typeof createServerSupabaseAdmin>,
  userEmail: string,
  entityType: LibraryEntityType,
  entityId: string
): Promise<boolean> {
  if (entityType === "upload") {
    const { data } = await supabase
      .from("pdf_uploads")
      .select("id")
      .eq("id", entityId)
      .eq("user_email", userEmail)
      .maybeSingle();
    return Boolean(data);
  }
  if (entityType === "frq_upload") {
    const { data } = await supabase
      .from("frq_uploads")
      .select("id")
      .eq("id", entityId)
      .eq("user_email", userEmail)
      .maybeSingle();
    return Boolean(data);
  }
  if (entityType === "frq_attempt") {
    const { data } = await supabase
      .from("frq_attempts")
      .select("id")
      .eq("id", entityId)
      .eq("user_email", userEmail)
      .maybeSingle();
    return Boolean(data);
  }
  const { data } = await supabase
    .from("attempts")
    .select("id")
    .eq("id", entityId)
    .eq("user_email", userEmail)
    .maybeSingle();
  return Boolean(data);
}

const VALID_ENTITY_TYPES: LibraryEntityType[] = [
  "upload",
  "attempt",
  "frq_upload",
  "frq_attempt",
];

function isValidEntityType(value: unknown): value is LibraryEntityType {
  return typeof value === "string" && VALID_ENTITY_TYPES.includes(value as LibraryEntityType);
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      entityType?: LibraryEntityType;
      entityId?: string;
      name?: string;
    };

    const entityType = body.entityType;
    const entityId = body.entityId?.trim();
    const name = body.name?.trim() ?? "";

    if (!isValidEntityType(entityType)) {
      return NextResponse.json({ error: "Invalid entity type." }, { status: 400 });
    }
    if (!entityId) {
      return NextResponse.json({ error: "Entity ID is required." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();
    const owned = await assertEntityOwnership(supabase, userEmail, entityType, entityId);
    if (!owned) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const tag = await createEntityTag(supabase, userEmail, entityType, entityId, name);
    return NextResponse.json({ tag });
  } catch (err) {
    console.error("[library/taggings POST]", err);
    const message = err instanceof Error ? err.message : "Request failed.";
    const status = message.includes("already used") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const entityType = params.get("entityType") as LibraryEntityType | null;
    const entityId = params.get("entityId")?.trim();
    const tagId = params.get("tagId")?.trim();

    if (!isValidEntityType(entityType)) {
      return NextResponse.json({ error: "Invalid entity type." }, { status: 400 });
    }
    if (!entityId || !tagId) {
      return NextResponse.json({ error: "Entity ID and tag ID are required." }, { status: 400 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();
    const owned = await assertEntityOwnership(supabase, userEmail, entityType, entityId);
    if (!owned) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    await removeEntityTag(supabase, userEmail, entityType, entityId, tagId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[library/taggings DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user?.email) {
      return NextResponse.json({ error: authError ?? "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      entityType?: LibraryEntityType;
      entityId?: string;
      tagIds?: string[];
    };

    const entityType = body.entityType;
    const entityId = body.entityId?.trim();
    if (!isValidEntityType(entityType)) {
      return NextResponse.json({ error: "Invalid entity type." }, { status: 400 });
    }
    if (!entityId) {
      return NextResponse.json({ error: "Entity ID is required." }, { status: 400 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const supabase = createServerSupabaseAdmin();
    const owned = await assertEntityOwnership(supabase, userEmail, entityType, entityId);
    if (!owned) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    await replaceEntityTags(
      supabase,
      userEmail,
      entityType,
      entityId,
      body.tagIds ?? []
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[library/taggings PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 500 }
    );
  }
}
