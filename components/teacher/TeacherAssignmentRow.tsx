"use client";

import { useMemo, useState } from "react";
import { Eye, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ResourceShareButton } from "@/components/teacher/ResourceShareButton";
import { teacherAuthHeaders } from "@/components/teacher/TeacherAuthProvider";
import { publishApiUrl } from "@/lib/exam-publish-utils";
import { viewResource } from "@/lib/open-resource";
import {
  applyExamPublishResponse,
  applyResourcePublishResponse,
  getAssignmentRowActions,
  type AssignmentContentMeta,
  type TeacherClassAssignment,
} from "@/lib/teacher-assignment-content";
import { cn } from "@/lib/utils";

type TeacherAssignmentRowProps = {
  assignment: TeacherClassAssignment;
  classId: string;
  accessToken: string;
  onRemoved: (assignmentId: string) => void;
  onContentUpdated: (assignmentId: string, content: AssignmentContentMeta) => void;
  onError: (message: string) => void;
};

export function TeacherAssignmentRow({
  assignment,
  classId,
  accessToken,
  onRemoved,
  onContentUpdated,
  onError,
}: TeacherAssignmentRowProps) {
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showUnpublish, setShowUnpublish] = useState(false);
  const [publishConsent, setPublishConsent] = useState(false);

  const actions = useMemo(() => getAssignmentRowActions(assignment), [assignment]);
  const headers = teacherAuthHeaders(accessToken);

  const kindLabel =
    assignment.kind === "exam"
      ? "MCQ exam"
      : assignment.kind === "frq_exam"
        ? "FRQ exam"
        : "Resource";

  const handleView = async () => {
    if (assignment.kind === "resource" && assignment.resourceId) {
      setPreviewing(true);
      try {
        await viewResource(
          assignment.resourceId,
          headers,
          assignment.content.resourceType === "link" ? assignment.content.externalUrl : null
        );
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not open resource.");
      } finally {
        setPreviewing(false);
      }
      return;
    }
    if (actions.viewPath) {
      window.open(actions.viewPath, "_blank", "noopener,noreferrer");
    }
  };

  const publishExam = async (isPublished: boolean) => {
    if (!actions.contentId || !actions.examKind) return;
    setBusy(true);
    try {
      const res = await fetch(publishApiUrl(actions.examKind, actions.contentId), {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Publish update failed.");
      }
      onContentUpdated(
        assignment.id,
        applyExamPublishResponse(assignment.content, {
          isPublished: data.isPublished === true,
          moderationStatus: data.moderationStatus,
        })
      );
      setShowPublish(false);
      setShowUnpublish(false);
      setPublishConsent(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Publish update failed.");
    } finally {
      setBusy(false);
    }
  };

  const publishResource = async (visibility: "public" | "private") => {
    if (!assignment.resourceId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/resources/${assignment.resourceId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          publishConsent: visibility === "public" ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update resource visibility.");
      }
      onContentUpdated(
        assignment.id,
        applyResourcePublishResponse(assignment.content, {
          visibility: data.resource?.visibility,
          moderationStatus: data.resource?.moderationStatus,
        })
      );
      setShowPublish(false);
      setShowUnpublish(false);
      setPublishConsent(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update resource.");
    } finally {
      setBusy(false);
    }
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishConsent) {
      onError("You must accept responsibility for publishing this content publicly.");
      return;
    }
    if (assignment.kind === "resource") {
      await publishResource("public");
      return;
    }
    setBusy(true);
    try {
      const consentRes = await fetch("/api/user/record-consent", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ consentType: "public_publish", granted: true }),
      });
      if (!consentRes.ok) {
        throw new Error("Could not save publish consent.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save publish consent.");
      setBusy(false);
      return;
    }
    setBusy(false);
    await publishExam(true);
  };

  const handleRemove = async () => {
    if (!confirm("Remove this assignment from the class?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/assignments/${assignment.id}`,
        { method: "DELETE", headers }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove assignment.");
      onRemoved(assignment.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-gray-900">{assignment.title}</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">
              {kindLabel}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                actions.statusBadgeClass
              )}
            >
              {actions.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {assignment.dueAt
              ? `Due ${new Date(assignment.dueAt).toLocaleString()}`
              : "No due date"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.showView && (
            <RowButton onClick={() => void handleView()} disabled={busy || previewing}>
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : assignment.kind === "resource" &&
                assignment.content.resourceType === "link" ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {assignment.kind === "resource" && assignment.content.resourceType === "link"
                ? "Open link"
                : "View"}
            </RowButton>
          )}

          {actions.showPublish && (
            <RowButton onClick={() => setShowPublish(true)} disabled={busy}>
              Publish
            </RowButton>
          )}

          {actions.showMakePrivate && (
            <RowButton onClick={() => setShowUnpublish(true)} disabled={busy}>
              Make private
            </RowButton>
          )}

          {actions.showShare && actions.contentId && actions.examKind && (
            <ExamShareButton
              examId={actions.contentId}
              examKind={actions.examKind}
              fullWidth={false}
            />
          )}

          {actions.showShare && assignment.kind === "resource" && (
            <ResourceShareButton />
          )}

          <RowButton
            onClick={() => void handleRemove()}
            disabled={busy}
            className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </RowButton>
        </div>
      </div>

      {showPublish && (
        <Modal title="Publish Content" onClose={() => setShowPublish(false)}>
          <form onSubmit={(e) => void handlePublishSubmit(e)} className="space-y-4">
            <p className="text-sm text-gray-600">
              This content will be submitted for moderator review before appearing publicly on the
              platform.
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={publishConsent}
                onChange={(e) => setPublishConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand this content will be published under my name on the platform. I accept
                full responsibility for its content and confirm it complies with our privacy and
                copyright policies. It will be reviewed by a moderator before going live.
              </span>
            </label>
            <ModalActions
              onCancel={() => setShowPublish(false)}
              saving={busy}
              saveLabel="Submit for review"
            />
          </form>
        </Modal>
      )}

      {showUnpublish && (
        <Modal title="Make Content Private" onClose={() => setShowUnpublish(false)}>
          <p className="text-sm text-gray-600">
            This content will be removed from the public catalog. Students can still access it
            through class assignments.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUnpublish(false)}
              className="rounded-md px-4 py-2 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                void (assignment.kind === "resource"
                  ? publishResource("private")
                  : publishExam(false))
              }
              disabled={busy}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Make private"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  saving,
  saveLabel,
}: {
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-gray-600">
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
