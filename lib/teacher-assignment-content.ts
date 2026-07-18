import {
  canRequestPublish,
  canUnpublishExam,
  getModerationStatusBadgeClass,
  getModerationStatusLabel,
  isExamLivePublished,
  type ExamPublishState,
} from "@/lib/exam-publish-utils";
import {
  canMakeResourcePrivate,
  canRequestResourcePublish,
  getResourceModerationStatusBadgeClass,
  getResourceModerationStatusLabel,
  isResourceLivePublic,
  type ResourcePublishState,
} from "@/lib/resource-publish-utils";

export type AssignmentContentMeta = {
  isPublished?: boolean;
  moderationStatus?: string;
  resourceType?: "file" | "link";
  visibility?: "private" | "public";
  externalUrl?: string | null;
  fileName?: string | null;
};

export type TeacherClassAssignment = {
  id: string;
  kind: string;
  uploadId: string | null;
  frqUploadId: string | null;
  resourceId: string | null;
  title: string;
  dueAt: string | null;
  createdAt: string;
  content: AssignmentContentMeta;
};

export type AssignmentRowActions = {
  showView: boolean;
  showPublish: boolean;
  showMakePrivate: boolean;
  showShare: boolean;
  statusLabel: string;
  statusBadgeClass: string;
  viewPath: string | null;
  contentId: string | null;
  examKind: "mcq" | "frq" | null;
};

export function getAssignmentContentId(assignment: TeacherClassAssignment): string | null {
  if (assignment.kind === "exam") return assignment.uploadId;
  if (assignment.kind === "frq_exam") return assignment.frqUploadId;
  if (assignment.kind === "resource") return assignment.resourceId;
  return null;
}

export function getAssignmentViewPath(assignment: TeacherClassAssignment): string | null {
  if (assignment.kind === "exam" && assignment.uploadId) {
    return `/exam/${assignment.uploadId}`;
  }
  if (assignment.kind === "frq_exam" && assignment.frqUploadId) {
    return `/frq/${assignment.frqUploadId}`;
  }
  return null;
}

export function getAssignmentRowActions(
  assignment: TeacherClassAssignment
): AssignmentRowActions {
  const contentId = getAssignmentContentId(assignment);
  const viewPath = getAssignmentViewPath(assignment);
  const showView =
    assignment.kind === "resource"
      ? Boolean(contentId)
      : Boolean(viewPath);

  if (assignment.kind === "resource") {
    const state: ResourcePublishState = {
      visibility: assignment.content.visibility ?? "private",
      moderationStatus: assignment.content.moderationStatus ?? "draft",
    };
    return {
      showView,
      showPublish: canRequestResourcePublish(state),
      showMakePrivate: canMakeResourcePrivate(state),
      showShare: isResourceLivePublic(state),
      statusLabel: getResourceModerationStatusLabel(state),
      statusBadgeClass: getResourceModerationStatusBadgeClass(state),
      viewPath,
      contentId,
      examKind: null,
    };
  }

  const examState: ExamPublishState = {
    isPublished: assignment.content.isPublished === true,
    moderationStatus: assignment.content.moderationStatus ?? "draft",
  };

  return {
    showView,
    showPublish: canRequestPublish(examState.moderationStatus),
    showMakePrivate: canUnpublishExam(examState),
    showShare: isExamLivePublished(examState),
    statusLabel: getModerationStatusLabel(examState),
    statusBadgeClass: getModerationStatusBadgeClass(examState),
    viewPath,
    contentId,
    examKind: assignment.kind === "frq_exam" ? "frq" : assignment.kind === "exam" ? "mcq" : null,
  };
}

export function applyExamPublishResponse(
  content: AssignmentContentMeta,
  data: { isPublished?: boolean; moderationStatus?: string }
): AssignmentContentMeta {
  return {
    ...content,
    isPublished: data.isPublished === true,
    moderationStatus: data.moderationStatus ?? content.moderationStatus,
  };
}

export function applyResourcePublishResponse(
  content: AssignmentContentMeta,
  data: { visibility?: string; moderationStatus?: string }
): AssignmentContentMeta {
  return {
    ...content,
    visibility: data.visibility === "public" ? "public" : "private",
    moderationStatus: data.moderationStatus ?? content.moderationStatus,
  };
}
