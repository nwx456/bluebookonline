import type { ModerationStatus } from "@/lib/moderator-auth";

export type ExamPublishState = {
  isPublished: boolean;
  moderationStatus: ModerationStatus | string;
};

export const UNPUBLISH_CONFIRM_COOLDOWN_SEC = 3;

export function isExamLivePublished(exam: ExamPublishState): boolean {
  return exam.isPublished === true && exam.moderationStatus === "approved";
}

export function canRequestPublish(moderationStatus: ModerationStatus | string): boolean {
  return moderationStatus === "draft" || moderationStatus === "rejected";
}

export function canUnpublishExam(exam: ExamPublishState): boolean {
  return isExamLivePublished(exam);
}

export function isPendingReview(moderationStatus: ModerationStatus | string): boolean {
  return moderationStatus === "pending_review";
}

export function getModerationStatusLabel(exam: ExamPublishState): string {
  if (isExamLivePublished(exam)) return "Published";
  if (exam.moderationStatus === "pending_review") return "Pending";
  if (exam.moderationStatus === "rejected") return "Rejected";
  return "Private";
}

export function getModerationStatusBadgeClass(exam: ExamPublishState): string {
  if (isExamLivePublished(exam)) {
    return "bg-green-100 text-green-800";
  }
  switch (exam.moderationStatus) {
    case "pending_review":
      return "bg-amber-100 text-amber-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function getPublishActionLabel(_moderationStatus?: ModerationStatus | string): string {
  return "Publish";
}

export function publishApiUrl(examKind: "mcq" | "frq", examId: string): string {
  return examKind === "frq"
    ? `/api/frq/upload/${examId}/publish`
    : `/api/upload/${examId}/publish`;
}
