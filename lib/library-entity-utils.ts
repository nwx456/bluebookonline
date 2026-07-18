import type { LibraryEntityType, LibraryExamKind } from "@/lib/library-types";

export function uploadEntityType(examKind: LibraryExamKind): LibraryEntityType {
  return examKind === "frq" ? "frq_upload" : "upload";
}

export function attemptEntityType(examKind: LibraryExamKind): LibraryEntityType {
  return examKind === "frq" ? "frq_attempt" : "attempt";
}

export function uploadStartHref(exam: { id: string; examKind: LibraryExamKind }): string {
  return exam.examKind === "frq" ? `/frq/${exam.id}` : `/exam/${exam.id}`;
}

export function attemptReviewHref(attempt: {
  id: string;
  uploadId: string;
  examKind: LibraryExamKind;
}): string {
  return attempt.examKind === "frq"
    ? `/frq/${attempt.uploadId}?reviewAttemptId=${attempt.id}`
    : `/exam/${attempt.uploadId}?attempt=${attempt.id}`;
}
