export type ExamStartAccessInput = {
  isOwner: boolean;
  isPublic: boolean;
  hasAssignmentAccess: boolean;
};

/** Whether a user may start an exam attempt under the existing + class assignment rules. */
export function canStartExamAccess(input: ExamStartAccessInput): boolean {
  return input.isOwner || input.isPublic || input.hasAssignmentAccess;
}

export type ResourceDownloadAccessInput = {
  isOwner: boolean;
  isPublicApproved: boolean;
  isAssignedClassMember: boolean;
};

/** Whether a user may download or open a teacher resource. */
export function canAccessResource(input: ResourceDownloadAccessInput): boolean {
  return input.isOwner || input.isPublicApproved || input.isAssignedClassMember;
}
