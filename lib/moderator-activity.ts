import { getFrqExamDisplayName, getMcqExamDisplayName } from "@/lib/exam-display-name";

export type ModeratorActivityAction =
  | "approve"
  | "reject"
  | "unpublish"
  | "dismiss"
  | "delete"
  | "notify";

export type ModeratorActivityTargetType = "exam_mcq" | "exam_frq" | "report";

export type ModeratorActivityItem = {
  id: string;
  at: string;
  moderatorEmail: string;
  action: ModeratorActivityAction;
  targetType: ModeratorActivityTargetType;
  targetLabel: string;
  note: string | null;
};

export function deriveExamModerationAction(params: {
  moderationStatus: string | null;
  isPublished: boolean | null;
}): ModeratorActivityAction | null {
  const status = params.moderationStatus ?? "";
  const published = params.isPublished === true;

  if (status === "rejected") return "reject";
  if (status === "approved" && published) return "approve";
  if (status === "draft" && !published) return "unpublish";
  return null;
}

export function mcqExamActivityLabel(params: {
  displayTitle?: string | null;
  filename?: string | null;
}): string {
  return getMcqExamDisplayName(params);
}

export function frqExamActivityLabel(params: {
  displayTitle?: string | null;
  title?: string | null;
}): string {
  return getFrqExamDisplayName(params);
}
