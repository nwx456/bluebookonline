export type ModeratorExamKind = "mcq" | "frq";

export function parseModeratorExamKind(value: string | null | undefined): ModeratorExamKind {
  return value?.trim().toLowerCase() === "frq" ? "frq" : "mcq";
}

export function moderatorUploadTable(examKind: ModeratorExamKind): "pdf_uploads" | "frq_uploads" {
  return examKind === "frq" ? "frq_uploads" : "pdf_uploads";
}
