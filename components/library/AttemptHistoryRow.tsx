"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Eye,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import type { LibraryAttemptItem } from "@/lib/library-types";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/subjects";
import { getFrqCourseLabel } from "@/lib/frq-courses";
import { estimateApScore } from "@/lib/ap-score-estimate";
import { isSatFullTest, satSectionForSubject } from "@/lib/exam-program";
import { attemptEntityType, attemptReviewHref } from "@/lib/library-entity-utils";
import { TagPicker } from "@/components/library/TagPicker";
import { useArchiveUndo } from "@/components/library/ArchiveUndoToast";
import { cn } from "@/lib/utils";

interface AttemptHistoryRowProps {
  attempt: LibraryAttemptItem;
  busy?: boolean;
  onRename: (title: string) => Promise<void>;
  onNotes: () => void;
  onArchiveToggle: (archived: boolean) => Promise<void>;
  onAddTag: (name: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onAfterRestore?: () => void;
}

export function AttemptHistoryRow({
  attempt,
  busy,
  onRename,
  onNotes,
  onArchiveToggle,
  onAddTag,
  onRemoveTag,
  onDelete,
  onAfterRestore,
}: AttemptHistoryRowProps) {
  const { notifyArchived } = useArchiveUndo();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(attempt.title);

  const saveTitle = async () => {
    await onRename(draftTitle);
    setEditing(false);
  };

  const handleArchiveToggle = async () => {
    const archiving = !attempt.archivedAt;
    await onArchiveToggle(archiving);
    if (archiving) {
      notifyArchived(
        { entityType: attemptEntityType(attempt.examKind), entityId: attempt.id, title: attempt.title },
        onAfterRestore
      );
    }
  };

  const reviewHref = attemptReviewHref(attempt);

  const subjectLabel =
    attempt.examKind === "frq"
      ? getFrqCourseLabel(attempt.subject)
      : SUBJECT_LABELS[attempt.subject as SubjectKey] ?? attempt.subject;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                  setDraftTitle(attempt.title);
                  setEditing(false);
                }}
                className="text-xs text-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{attempt.title}</h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  attempt.examKind === "frq"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {attempt.examKind === "frq" ? "FRQ" : "MCQ"}
              </span>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {subjectLabel}
            {" · "}
            {new Date(attempt.completedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          {attempt.personalNotes && (
            <p className="mt-2 text-xs text-gray-600 line-clamp-2">{attempt.personalNotes}</p>
          )}
          <div className="mt-3">
            <TagPicker
              assignedTags={attempt.tags}
              disabled={busy}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="text-right">
            {attempt.examProgram === "SAT" ? (
              <>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                  {attempt.totalScaledScore ?? attempt.rwScaledScore ?? attempt.mathScaledScore ?? "—"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {isSatFullTest(attempt.subject)
                    ? "Total"
                    : satSectionForSubject(attempt.subject) === "rw"
                      ? "R&W"
                      : "Math"}
                </p>
              </>
            ) : attempt.examKind === "frq" ? (
              <>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                  {attempt.totalScore ?? 0}
                  <span className="text-lg font-normal text-gray-500">
                    {" "}/ {attempt.maxScore ?? 0}
                  </span>
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  FRQ points ({attempt.percentage ?? 0}%)
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                  {attempt.percentage ?? "—"}%
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  AP est. {estimateApScore(attempt.percentage) ?? "—"}
                </p>
              </>
            )}
            <p className="mt-1 text-xs text-gray-500 tabular-nums">
              {attempt.examKind === "frq"
                ? `${attempt.totalScore ?? 0}/${attempt.maxScore ?? 0} points earned`
                : `${attempt.correctCount}/${attempt.totalQuestions} correct`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={reviewHref}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Eye className="h-3.5 w-3.5" />
              Review
            </Link>
            {attempt.examKind !== "frq" ? (
              <Link
                href={`${reviewHref}&wrongOnly=1`}
                className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Wrong only
              </Link>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraftTitle(attempt.displayTitle ?? attempt.title);
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
              aria-label={attempt.archivedAt ? "Restore" : "Archive"}
            >
              {attempt.archivedAt ? (
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
              aria-label="Delete attempt"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
