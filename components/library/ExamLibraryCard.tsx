"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  FileText,
  Pencil,
  Play,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { LibraryUploadItem } from "@/lib/library-types";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/subjects";
import { sourceTypeShortLabel } from "@/lib/exam-source";
import {
  canRequestPublish,
  canUnpublishExam,
  getPublishActionLabel,
  isExamLivePublished,
  isPendingReview,
} from "@/lib/exam-publish-utils";
import { uploadEntityType, uploadStartHref } from "@/lib/library-entity-utils";
import { ExamShareButton } from "@/components/exams/ExamShareButton";
import { ExamModerationBadge } from "@/components/library/ExamModerationBadge";
import { TagPicker } from "@/components/library/TagPicker";
import { useArchiveUndo } from "@/components/library/ArchiveUndoToast";
import { cn } from "@/lib/utils";

interface ExamLibraryCardProps {
  exam: LibraryUploadItem;
  busy?: boolean;
  onRename: (title: string) => Promise<void>;
  onNotes: () => void;
  onArchiveToggle: (archived: boolean) => Promise<void>;
  onAddTag: (name: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onRequestPublish?: () => void;
  onUnpublish?: () => void;
  publishBusy?: boolean;
  onAfterRestore?: () => void;
}

export function ExamLibraryCard({
  exam,
  busy,
  onRename,
  onNotes,
  onArchiveToggle,
  onAddTag,
  onRemoveTag,
  onDelete,
  onRequestPublish,
  onUnpublish,
  publishBusy,
  onAfterRestore,
}: ExamLibraryCardProps) {
  const { notifyArchived } = useArchiveUndo();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(exam.title);

  const saveTitle = async () => {
    await onRename(draftTitle);
    setEditing(false);
  };

  const handleArchiveToggle = async () => {
    const archiving = !exam.archivedAt;
    await onArchiveToggle(archiving);
    if (archiving) {
      notifyArchived(
        { entityType: uploadEntityType(exam.examKind), entityId: exam.id, title: exam.title },
        onAfterRestore
      );
    }
  };

  const subjectLabel =
    exam.examKind === "frq"
      ? exam.courseLabel ?? exam.subject
      : SUBJECT_LABELS[exam.subject as SubjectKey] ?? exam.subject;

  const startHref = uploadStartHref(exam);
  const canStart = exam.examKind === "mcq" || exam.examKind === "frq";
  const showRequestPublish = canRequestPublish(exam.moderationStatus);
  const showUnpublish = canUnpublishExam(exam);
  const pending = isPendingReview(exam.moderationStatus);

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveTitle()}
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTitle(exam.title);
                      setEditing(false);
                    }}
                    className="text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{exam.title}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      exam.examKind === "frq"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {exam.examKind === "frq" ? "FRQ" : "MCQ"}
                  </span>
                  <ExamModerationBadge exam={exam} />
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {subjectLabel}
                {" · "}
                {exam.questionCount} questions
                {exam.examKind === "frq" && exam.maxScore != null ? ` · ${exam.maxScore} pts` : ""}
                {" · "}
                {new Date(exam.uploadedAt).toLocaleDateString()}
              </p>
              {pending && (
                <p className="mt-1 text-xs text-amber-700">Publish is pending moderation.</p>
              )}
              {exam.moderationStatus === "rejected" && (
                <p className="mt-1 text-xs text-red-700">
                  This exam was rejected. Edit and publish again.
                </p>
              )}
              {exam.sourceName && (
                <p className="mt-0.5 text-[11px] text-gray-400 truncate">
                  Source: {exam.sourceType ? sourceTypeShortLabel(exam.sourceType as "book" | "agency" | "school") : "—"}
                  {" · "}
                  {exam.sourceName}
                </p>
              )}
              {exam.examKind === "mcq" && exam.filename !== exam.title && (
                <p className="mt-0.5 text-[11px] text-gray-400 truncate">PDF: {exam.filename}</p>
              )}
              {exam.personalNotes && (
                <p className="mt-2 text-xs text-gray-600 line-clamp-2">{exam.personalNotes}</p>
              )}
            </div>
          </div>

          <div className="mt-3">
            <TagPicker
              assignedTags={exam.tags}
              disabled={busy}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canStart && (
            <Link
              href={startHref}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Link>
          )}
          {isExamLivePublished(exam) && (
            <ExamShareButton
              examId={exam.id}
              examKind={exam.examKind}
              fullWidth={false}
              className="px-2.5 py-1.5 text-xs"
            />
          )}
          {showRequestPublish && onRequestPublish && (
            <button
              type="button"
              disabled={publishBusy}
              onClick={onRequestPublish}
              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60"
            >
              {getPublishActionLabel(exam.moderationStatus)}
            </button>
          )}
          {showUnpublish && onUnpublish && (
            <button
              type="button"
              disabled={publishBusy}
              onClick={onUnpublish}
              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraftTitle(exam.displayTitle ?? exam.title);
              setEditing(true);
            }}
            className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onNotes}
            className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Notes"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleArchiveToggle()}
            className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label={exam.archivedAt ? "Restore" : "Archive"}
          >
            {exam.archivedAt ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDelete()}
            className="rounded-md border border-gray-200 p-1.5 text-red-600 hover:bg-red-50"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
