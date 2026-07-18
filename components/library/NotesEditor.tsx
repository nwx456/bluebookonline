"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  open: boolean;
  title: string;
  initialNotes: string;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
}

export function NotesEditor({ open, title, initialNotes, onClose, onSave }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setError(null);
    }
  }, [open, initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(notes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl safe-area-bottom">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Notes</p>
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div className="flex-1 p-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={12}
            placeholder="Add personal notes about this exam or attempt…"
            className="h-full min-h-[240px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-gray-200 px-4 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className={cn(
              "rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700",
              saving && "opacity-50 cursor-not-allowed"
            )}
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Sheet import kept for design-system alignment; overlay uses lightweight panel above.
