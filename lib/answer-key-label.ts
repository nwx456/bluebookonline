export type AnswerKeyKind = "pdf" | "ai" | "mixed" | "unknown" | "none";

export function countRowsWithPdfAnswerKey(
  rows: Array<{ correct_answer?: string | null }>
): number {
  return rows.filter((r) => {
    const c = r.correct_answer;
    return c != null && String(c).trim() !== "";
  }).length;
}

/** Label answer key source from upload-time snapshot counts. */
export function getAnswerKeyLabel(
  answerKeyFromPdf: number | null | undefined,
  extractedCount: number
): { label: string; kind: AnswerKeyKind; title: string } {
  if (extractedCount === 0) {
    return {
      label: "—",
      kind: "none",
      title: "No questions extracted",
    };
  }
  if (answerKeyFromPdf == null) {
    return {
      label: "Unknown",
      kind: "unknown",
      title: "Upload predates answer key tracking",
    };
  }
  if (answerKeyFromPdf >= extractedCount) {
    return {
      label: "PDF",
      kind: "pdf",
      title: "Answer key was found in the PDF for all extracted questions",
    };
  }
  if (answerKeyFromPdf === 0) {
    return {
      label: "AI",
      kind: "ai",
      title: "No answer key in PDF; grading requires AI on first attempt",
    };
  }
  return {
    label: `Partial (${answerKeyFromPdf}/${extractedCount})`,
    kind: "mixed",
    title: `${answerKeyFromPdf} of ${extractedCount} questions had answer key in PDF`,
  };
}
