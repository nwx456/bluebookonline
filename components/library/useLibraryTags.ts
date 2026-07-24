"use client";

import { useCallback, useEffect, useState } from "react";
import type { LibraryEntityType, LibraryTag } from "@/lib/library-types";
import { libraryAuthHeaders, useDashboardAuth } from "@/components/library/DashboardAuthProvider";

export function useLibraryTags() {
  const { accessToken } = useDashboardAuth();
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/library/tags?usedOnly=true", {
        headers: libraryAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (res.ok) setTags(data.tags ?? []);
    } catch {
      // best-effort tag load
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tags, loading, refresh };
}

export async function addEntityTag(
  accessToken: string,
  entityType: LibraryEntityType,
  entityId: string,
  name: string
): Promise<LibraryTag> {
  const res = await fetch("/api/library/taggings", {
    method: "POST",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entityType, entityId, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not add tag.");
  return data.tag as LibraryTag;
}

export async function removeEntityTag(
  accessToken: string,
  entityType: LibraryEntityType,
  entityId: string,
  tagId: string
) {
  const params = new URLSearchParams({
    entityType,
    entityId,
    tagId,
  });
  const res = await fetch(`/api/library/taggings?${params.toString()}`, {
    method: "DELETE",
    headers: libraryAuthHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not remove tag.");
  return data;
}

export async function patchFrqUploadLibraryFields(
  accessToken: string,
  id: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/library/frq-uploads/${id}`, {
    method: "PATCH",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed.");
  return data;
}

export async function patchFrqAttemptLibraryFields(
  accessToken: string,
  id: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/library/frq-attempts/${id}`, {
    method: "PATCH",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed.");
  return data;
}

export async function patchUploadLibraryFields(
  accessToken: string,
  id: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/library/uploads/${id}`, {
    method: "PATCH",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed.");
  return data;
}

export async function patchAttemptLibraryFields(
  accessToken: string,
  id: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`/api/library/attempts/${id}`, {
    method: "PATCH",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed.");
  return data;
}

export async function replaceTaggings(
  accessToken: string,
  entityType: LibraryEntityType,
  entityId: string,
  tagIds: string[]
) {
  const res = await fetch("/api/library/taggings", {
    method: "PUT",
    headers: {
      ...libraryAuthHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entityType, entityId, tagIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not update tags.");
  return data;
}
