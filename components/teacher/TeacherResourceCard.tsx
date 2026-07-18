"use client";

import { useState } from "react";
import {
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { ResourceShareButton } from "@/components/teacher/ResourceShareButton";
import { teacherAuthHeaders } from "@/components/teacher/TeacherAuthProvider";
import { downloadResourceFile, viewResource } from "@/lib/open-resource";
import {
  canMakeResourcePrivate,
  canRequestResourcePublish,
  getResourceModerationStatusBadgeClass,
  getResourceModerationStatusLabel,
  getResourcePublishActionLabel,
  isResourceLivePublic,
  isResourcePendingReview,
} from "@/lib/resource-publish-utils";
import type { TeacherResourceItem } from "@/lib/teacher-resource-map";
import { cn } from "@/lib/utils";

type TeacherResourceCardProps = {
  resource: TeacherResourceItem;
  accessToken: string;
  busy?: boolean;
  onUpdated: (resource: TeacherResourceItem) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
};

export function TeacherResourceCard({
  resource,
  accessToken,
  busy,
  onUpdated,
  onDeleted,
  onError,
}: TeacherResourceCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showUnpublish, setShowUnpublish] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [description, setDescription] = useState(resource.description ?? "");
  const [externalUrl, setExternalUrl] = useState(resource.externalUrl ?? "");
  const [publishConsent, setPublishConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const publishState = {
    visibility: resource.visibility,
    moderationStatus: resource.moderationStatus,
  };
  const statusLabel = getResourceModerationStatusLabel(publishState);
  const statusClass = getResourceModerationStatusBadgeClass(publishState);
  const showRequestPublish = canRequestResourcePublish(publishState);
  const showMakePrivate = canMakeResourcePrivate(publishState);
  const showShare = isResourceLivePublic(publishState);
  const pending = isResourcePendingReview(publishState);

  const headers = teacherAuthHeaders(accessToken);

  const handleView = async () => {
    setPreviewing(true);
    try {
      await viewResource(
        resource.id,
        headers,
        resource.resourceType === "link" ? resource.externalUrl : null
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not open resource.");
    } finally {
      setPreviewing(false);
    }
  };

  const patchResource = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/resources/${resource.id}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update resource.");
      onUpdated(data.resource as TeacherResourceItem);
      return data.resource as TeacherResourceItem;
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patchResource({
        title: title.trim(),
        description: description.trim() || null,
        ...(resource.resourceType === "link" ? { externalUrl: externalUrl.trim() } : {}),
      });
      setShowEdit(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save changes.");
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishConsent) {
      onError("You must accept responsibility for publishing this resource publicly.");
      return;
    }
    try {
      await patchResource({ visibility: "public", publishConsent: true });
      setShowPublish(false);
      setPublishConsent(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not submit for review.");
    }
  };

  const handleMakePrivate = async () => {
    try {
      await patchResource({ visibility: "private" });
      setShowUnpublish(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not make resource private.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this resource?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/resources/${resource.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete resource.");
      onDeleted(resource.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete resource.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-gray-900">{resource.title}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">
                {resource.resourceType}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusClass)}>
                {statusLabel}
              </span>
            </div>
            {resource.description && (
              <p className="mt-1 text-sm text-gray-600">{resource.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {resource.resourceType === "file"
                ? resource.fileName ?? "File"
                : resource.externalUrl ?? "Link"}
              {pending ? " · Awaiting moderator approval" : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => void handleView()} disabled={previewing || saving || busy}>
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resource.resourceType === "link" ? (
                <ExternalLink className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {resource.resourceType === "link" ? "Open link" : "View"}
            </ActionButton>

            <ActionButton
              onClick={() => {
                setTitle(resource.title);
                setDescription(resource.description ?? "");
                setExternalUrl(resource.externalUrl ?? "");
                setShowEdit(true);
              }}
              disabled={saving || busy}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </ActionButton>

            {showRequestPublish && (
              <ActionButton onClick={() => setShowPublish(true)} disabled={saving || busy}>
                {getResourcePublishActionLabel()}
              </ActionButton>
            )}

            {showMakePrivate && (
              <ActionButton onClick={() => setShowUnpublish(true)} disabled={saving || busy}>
                Make private
              </ActionButton>
            )}

            {showShare && <ResourceShareButton />}

            <ActionButton
              onClick={() => void handleDelete()}
              disabled={saving || busy}
              className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </ActionButton>
          </div>
        </div>
      </article>

      {showEdit && (
        <Modal title="Edit Resource" onClose={() => setShowEdit(false)}>
          <form onSubmit={(e) => void handleEditSave(e)} className="space-y-4">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
            {resource.resourceType === "link" && (
              <Field label="URL">
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
            )}
            <ModalActions onCancel={() => setShowEdit(false)} saving={saving} saveLabel="Save" />
          </form>
        </Modal>
      )}

      {showPublish && (
        <Modal title="Publish Resource" onClose={() => setShowPublish(false)}>
          <form onSubmit={(e) => void handlePublish(e)} className="space-y-4">
            <p className="text-sm text-gray-600">
              This resource will be submitted for moderator review before appearing on the public
              resources catalog.
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={publishConsent}
                onChange={(e) => setPublishConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand this resource will be published under my name on the platform. I accept
                full responsibility for its content and confirm it complies with our privacy and
                copyright policies. It will be reviewed by a moderator before going live.
              </span>
            </label>
            <ModalActions
              onCancel={() => setShowPublish(false)}
              saving={saving}
              saveLabel="Submit for review"
            />
          </form>
        </Modal>
      )}

      {showUnpublish && (
        <Modal title="Make Resource Private" onClose={() => setShowUnpublish(false)}>
          <p className="text-sm text-gray-600">
            This resource will be removed from the public catalog. Class assignments will still
            work for students already assigned.
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
              onClick={() => void handleMakePrivate()}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Make private"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ActionButton({
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
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="mt-4">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="sr-only"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
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
