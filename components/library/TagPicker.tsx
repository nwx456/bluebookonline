"use client";

import { useState } from "react";
import type { LibraryTag } from "@/lib/library-types";
import { Plus, X } from "lucide-react";

interface TagPickerProps {
  assignedTags: LibraryTag[];
  disabled?: boolean;
  onAddTag: (name: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
}

export function TagPicker({
  assignedTags,
  disabled,
  onAddTag,
  onRemoveTag,
}: TagPickerProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAddTag(name);
      setNewName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add tag.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onRemoveTag(tagId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove tag.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color ?? "#2563eb" }}
          >
            {tag.name}
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void handleRemove(tag.id)}
              className="rounded-full p-0.5 hover:bg-black/10 disabled:opacity-50"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!creating ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              placeholder="Tag name"
              maxLength={40}
              className="w-28 rounded-md border border-gray-200 px-2 py-1 text-xs"
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAdd()}
              className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
                setError(null);
              }}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
