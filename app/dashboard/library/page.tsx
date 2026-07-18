"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LibraryUploadItem } from "@/lib/library-types";
import type { ModerationStatus } from "@/lib/moderator-auth";
import {
  libraryAuthHeaders,
  useDashboardAuth,
} from "@/components/library/DashboardAuthProvider";
import {
  buildLibraryQuery,
  LibraryToolbar,
  type LibraryToolbarState,
} from "@/components/library/LibraryToolbar";
import { ExamLibraryCard } from "@/components/library/ExamLibraryCard";
import { NotesEditor } from "@/components/library/NotesEditor";
import { UnpublishExamModal } from "@/components/library/UnpublishExamModal";
import { ConsentModal } from "@/components/ConsentModal";
import {
  addEntityTag,
  patchFrqUploadLibraryFields,
  patchUploadLibraryFields,
  removeEntityTag,
  useLibraryTags,
} from "@/components/library/useLibraryTags";
import {
  publishApiUrl,
  UNPUBLISH_CONFIRM_COOLDOWN_SEC,
} from "@/lib/exam-publish-utils";
import { useProgram } from "@/lib/use-program";
import { uploadEntityType } from "@/lib/library-entity-utils";

export default function DashboardLibraryPage() {
  const { accessToken } = useDashboardAuth();
  const { program } = useProgram();
  const searchParams = useSearchParams();
  const { tags, refresh: refreshTags } = useLibraryTags();
  const [uploads, setUploads] = useState<LibraryUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<LibraryUploadItem | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [unpublishTarget, setUnpublishTarget] = useState<LibraryUploadItem | null>(null);
  const [publishConsentTarget, setPublishConsentTarget] = useState<LibraryUploadItem | null>(
    null
  );
  const [consentLoading, setConsentLoading] = useState(false);
  const [unpublishCooldownSec, setUnpublishCooldownSec] = useState(0);
  const [toolbar, setToolbar] = useState<LibraryToolbarState>({
    q: "",
    subject: "",
    program: "",
    examKind: "all",
    archived: false,
    sort: "newest",
    tagIds: [],
  });

  useEffect(() => {
    const ek = searchParams.get("examKind");
    if (ek === "mcq" || ek === "frq" || ek === "all") {
      setToolbar((t) => ({ ...t, examKind: ek }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!unpublishTarget) {
      setUnpublishCooldownSec(0);
      return;
    }
    setUnpublishCooldownSec(UNPUBLISH_CONFIRM_COOLDOWN_SEC);
    const interval = setInterval(() => {
      setUnpublishCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [unpublishTarget]);

  const toolbarWithProgram = useMemo(
    () => ({ ...toolbar, program: program as "AP" | "SAT" }),
    [toolbar, program]
  );

  const loadUploads = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const query = buildLibraryQuery(toolbarWithProgram);
      const res = await fetch(`/api/library/uploads?${query}`, {
        headers: libraryAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (res.ok) setUploads(data.uploads ?? []);
    } finally {
      setLoading(false);
    }
  }, [accessToken, toolbarWithProgram]);

  useEffect(() => {
    void loadUploads();
  }, [loadUploads]);

  const updateExamPublishState = useCallback(
    (
      exam: LibraryUploadItem,
      patch: { isPublished: boolean; moderationStatus: ModerationStatus }
    ) => {
      setUploads((prev) =>
        prev.map((item) =>
          item.id === exam.id && item.examKind === exam.examKind
            ? { ...item, ...patch }
            : item
        )
      );
    },
    []
  );

  const applyPublishChange = useCallback(
    async (exam: LibraryUploadItem, isPublished: boolean): Promise<boolean> => {
      if (!accessToken) return false;
      setBusyId(exam.id);
      setPublishError(null);
      setPublishSuccess(null);
      try {
        const res = await fetch(publishApiUrl(exam.examKind, exam.id), {
          method: "PATCH",
          headers: {
            ...libraryAuthHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isPublished }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.code === "CONSENT_REQUIRED") {
            setPublishConsentTarget(exam);
            return false;
          }
          setPublishError((data.error as string) ?? "Publish update failed.");
          return false;
        }

        const moderationStatus =
          (data.moderationStatus as ModerationStatus) ??
          (isPublished ? "pending_review" : "draft");
        const nextPublished = data.isPublished === true;
        updateExamPublishState(exam, {
          isPublished: nextPublished,
          moderationStatus,
        });

        if (isPublished) {
          setPublishSuccess(`"${exam.title}" publish pending.`);
        } else {
          setPublishSuccess(`"${exam.title}" is now private.`);
        }

        await loadUploads();
        return true;
      } finally {
        setBusyId(null);
      }
    },
    [accessToken, loadUploads, updateExamPublishState]
  );

  const handleRequestPublish = useCallback(
    (exam: LibraryUploadItem) => {
      void applyPublishChange(exam, true);
    },
    [applyPublishChange]
  );

  const handleUnpublishClick = useCallback((exam: LibraryUploadItem) => {
    setUnpublishTarget(exam);
  }, []);

  const confirmUnpublish = useCallback(async () => {
    if (!unpublishTarget || unpublishCooldownSec > 0) return;
    const exam = unpublishTarget;
    setUnpublishTarget(null);
    await applyPublishChange(exam, false);
  }, [unpublishTarget, unpublishCooldownSec, applyPublishChange]);

  const confirmPublishConsent = useCallback(async () => {
    if (!accessToken || !publishConsentTarget) return;
    setConsentLoading(true);
    try {
      const res = await fetch("/api/user/record-consent", {
        method: "POST",
        headers: {
          ...libraryAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ consentType: "public_publish", granted: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPublishError((data.error as string) ?? "Could not save publish consent.");
        return;
      }
      const target = publishConsentTarget;
      setPublishConsentTarget(null);
      await applyPublishChange(target, true);
    } finally {
      setConsentLoading(false);
    }
  }, [accessToken, publishConsentTarget, applyPublishChange]);

  const patchUpload = async (exam: LibraryUploadItem, patch: Record<string, unknown>) => {
    if (!accessToken) return;
    setBusyId(exam.id);
    try {
      if (exam.examKind === "frq") {
        await patchFrqUploadLibraryFields(accessToken, exam.id, patch);
      } else {
        await patchUploadLibraryFields(accessToken, exam.id, patch);
      }
      await loadUploads();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (exam: LibraryUploadItem) => {
    if (!accessToken) return;
    if (!confirm(`Delete "${exam.title}"? This cannot be undone.`)) return;
    setBusyId(exam.id);
    try {
      const url =
        exam.examKind === "frq"
          ? `/api/frq/upload/${exam.id}`
          : `/api/upload/${exam.id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: libraryAuthHeaders(accessToken),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPublishError((data.error as string) ?? "Delete failed.");
        return;
      }
      await loadUploads();
    } finally {
      setBusyId(null);
    }
  };

  const entityType = (exam: LibraryUploadItem) => uploadEntityType(exam.examKind);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Library</h1>
        <p className="mt-1 text-sm text-gray-600">
          Organize uploaded MCQ and FRQ exams with tags, notes, archive, and publish status.
        </p>
      </div>

      {publishError && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {publishError}
        </div>
      )}
      {publishSuccess && (
        <div
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          {publishSuccess}
        </div>
      )}

      <LibraryToolbar value={toolbarWithProgram} tags={tags} onChange={setToolbar} />

      {loading ? (
        <p className="text-sm text-gray-500">Loading exams…</p>
      ) : uploads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">
            {toolbar.archived
              ? "No archived exams."
              : "No exams yet. Upload a PDF to build your library."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map((exam) => (
            <ExamLibraryCard
              key={`${exam.examKind}-${exam.id}`}
              exam={exam}
              busy={busyId === exam.id}
              onRename={(title) => patchUpload(exam, { displayTitle: title })}
              onNotes={() => setNotesTarget(exam)}
              onArchiveToggle={(archived) => patchUpload(exam, { archived })}
              onAddTag={async (name) => {
                if (!accessToken) return;
                setBusyId(exam.id);
                try {
                  await addEntityTag(accessToken, entityType(exam), exam.id, name);
                  await Promise.all([loadUploads(), refreshTags()]);
                } finally {
                  setBusyId(null);
                }
              }}
              onRemoveTag={async (tagId) => {
                if (!accessToken) return;
                setBusyId(exam.id);
                try {
                  await removeEntityTag(accessToken, entityType(exam), exam.id, tagId);
                  await Promise.all([loadUploads(), refreshTags()]);
                } finally {
                  setBusyId(null);
                }
              }}
              onDelete={() => handleDelete(exam)}
              onAfterRestore={() => void loadUploads()}
              onRequestPublish={() => handleRequestPublish(exam)}
              onUnpublish={() => handleUnpublishClick(exam)}
              publishBusy={busyId === exam.id}
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
          await patchUpload(notesTarget, { personalNotes: notes });
        }}
      />

      <UnpublishExamModal
        open={unpublishTarget != null}
        title={unpublishTarget?.title ?? ""}
        busy={busyId === unpublishTarget?.id}
        cooldownSec={unpublishCooldownSec}
        onConfirm={() => void confirmUnpublish()}
        onCancel={() => setUnpublishTarget(null)}
      />

      <ConsentModal
        open={publishConsentTarget != null}
        title="Public publish consent"
        confirmLabel="I agree and publish"
        onConfirm={() => void confirmPublishConsent()}
        onCancel={() => setPublishConsentTarget(null)}
        loading={consentLoading}
      >
        <p>
          By publishing this exam publicly, you confirm that you have the right to share
          this material and accept responsibility for its publication on the platform.
        </p>
      </ConsentModal>
    </div>
  );
}
