"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LibraryAttemptItem } from "@/lib/library-types";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import {
  buildLibraryQuery,
  LibraryToolbar,
  type LibraryToolbarState,
} from "@/components/library/LibraryToolbar";
import { AttemptHistoryRow } from "@/components/library/AttemptHistoryRow";
import { NotesEditor } from "@/components/library/NotesEditor";
import {
  addEntityTag,
  patchAttemptLibraryFields,
  patchFrqAttemptLibraryFields,
  removeEntityTag,
  useLibraryTags,
} from "@/components/library/useLibraryTags";
import { attemptEntityType } from "@/lib/library-entity-utils";
import { useProgram } from "@/lib/use-program";
import { Download } from "lucide-react";

export default function DashboardHistoryPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const { tags, refresh: refreshTags } = useLibraryTags();
  const [attempts, setAttempts] = useState<LibraryAttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<LibraryAttemptItem | null>(null);
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [toolbar, setToolbar] = useState<LibraryToolbarState>({
    q: "",
    subject: "",
    program: "",
    examKind: "all",
    archived: false,
    sort: "newest",
    tagIds: [],
  });

  const toolbarWithProgram = useMemo(
    () => ({ ...toolbar, program: program as "AP" | "SAT" }),
    [toolbar, program]
  );

  const loadAttempts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(buildLibraryQuery(toolbarWithProgram));
      if (scoreMin.trim()) params.set("scoreMin", scoreMin.trim());
      if (scoreMax.trim()) params.set("scoreMax", scoreMax.trim());
      const res = await fetch(`/api/library/attempts?${params.toString()}`, {
        headers: libraryAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (res.ok) setAttempts(data.attempts ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken, toolbarWithProgram, scoreMin, scoreMax]);

  useEffect(() => {
    void loadAttempts();
  }, [loadAttempts]);

  const updateAttempt = async (attempt: LibraryAttemptItem, patch: Record<string, unknown>) => {
    if (!accessToken) return;
    setBusyId(attempt.id);
    try {
      if (attempt.examKind === "frq") {
        await patchFrqAttemptLibraryFields(accessToken, attempt.id, patch);
      } else {
        await patchAttemptLibraryFields(accessToken, attempt.id, patch);
      }
      await loadAttempts();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (attempt: LibraryAttemptItem) => {
    if (!accessToken) return;
    const confirmMessage =
      attempt.examKind === "frq"
        ? "Remove this FRQ attempt from your history? The exam stays in your library."
        : "Remove this attempt from your history? The exam PDF stays in your library.";
    if (!confirm(confirmMessage)) return;

    setBusyId(attempt.id);
    try {
      const deleteUrl =
        attempt.examKind === "frq"
          ? `/api/frq/exam/attempt/${attempt.id}`
          : `/api/exam/attempt/${attempt.id}`;
      const res = await fetch(deleteUrl, {
        method: "DELETE",
        headers: libraryAuthHeaders(accessToken),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data.error as string) ?? "Delete failed.");
        return;
      }
      await loadAttempts();
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    if (!accessToken) return;
    const params = new URLSearchParams(buildLibraryQuery(toolbarWithProgram));
    params.set("format", "csv");
    if (scoreMin.trim()) params.set("scoreMin", scoreMin.trim());
    if (scoreMax.trim()) params.set("scoreMax", scoreMax.trim());
    const res = await fetch(`/api/library/export?${params.toString()}`, {
      headers: libraryAuthHeaders(accessToken),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">History</h1>
          <p className="mt-1 text-sm text-gray-600">
            Every completed attempt with scores, tags, and review links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <LibraryToolbar
        value={toolbarWithProgram}
        tags={tags}
        onChange={setToolbar}
        scoreMin={scoreMin}
        scoreMax={scoreMax}
        onScoreMinChange={setScoreMin}
        onScoreMaxChange={setScoreMax}
      />

      {loading ? (
        <p className="text-sm text-gray-500">Loading attempts…</p>
      ) : attempts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">
            {toolbar.archived ? "No archived attempts." : "Complete an exam to see it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <AttemptHistoryRow
              key={attempt.id}
              attempt={attempt}
              busy={busyId === attempt.id}
              onRename={(title) => updateAttempt(attempt, { displayTitle: title })}
              onNotes={() => setNotesTarget(attempt)}
              onArchiveToggle={(archived) => updateAttempt(attempt, { archived })}
              onAddTag={async (name) => {
                if (!accessToken) return;
                setBusyId(attempt.id);
                try {
                  await addEntityTag(
                    accessToken,
                    attemptEntityType(attempt.examKind),
                    attempt.id,
                    name
                  );
                  await Promise.all([loadAttempts(), refreshTags()]);
                } finally {
                  setBusyId(null);
                }
              }}
              onRemoveTag={async (tagId) => {
                if (!accessToken) return;
                setBusyId(attempt.id);
                try {
                  await removeEntityTag(
                    accessToken,
                    attemptEntityType(attempt.examKind),
                    attempt.id,
                    tagId
                  );
                  await Promise.all([loadAttempts(), refreshTags()]);
                } finally {
                  setBusyId(null);
                }
              }}
              onDelete={() => handleDelete(attempt)}
              onAfterRestore={() => void loadAttempts()}
            />
          ))}
        </div>
      )}

      <NotesEditor
        open={notesTarget != null}
        title={notesTarget?.title ?? ""}
        initialNotes={notesTarget?.personalNotes ?? ""}
        onClose={() => setNotesTarget(null)}
        onSave={async (notes) => {
          if (!notesTarget) return;
          await updateAttempt(notesTarget, { personalNotes: notes });
        }}
      />
    </div>
  );
}
