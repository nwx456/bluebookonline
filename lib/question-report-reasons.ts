export const QUESTION_REPORT_REASON_CODES = [
  "show_page_broken",
  "wrong_correct_answer",
  "question_text_error",
  "choices_missing_or_wrong",
  "visual_did_not_load",
  "code_render_issue",
  "math_notation_issue",
  "other",
] as const;

export type QuestionReportReasonCode = (typeof QUESTION_REPORT_REASON_CODES)[number];

export const QUESTION_REPORT_REASON_LABELS: Record<QuestionReportReasonCode, string> = {
  show_page_broken: "Show page button did not work",
  wrong_correct_answer: "Correct answer appears to be wrong",
  question_text_error: "Question text is unclear or contains errors",
  choices_missing_or_wrong: "Answer choices are missing or incorrect",
  visual_did_not_load: "Graph, image, or table did not load",
  code_render_issue: "Code snippet did not render properly",
  math_notation_issue: "Math notation displays incorrectly",
  other: "Other",
};

export const QUESTION_REPORT_REASONS = QUESTION_REPORT_REASON_CODES.map((code, index) => ({
  code,
  label: QUESTION_REPORT_REASON_LABELS[code],
  sortOrder: (index + 1) * 10,
}));

const REASON_SET = new Set<string>(QUESTION_REPORT_REASON_CODES);

export function isQuestionReportReasonCode(value: string): value is QuestionReportReasonCode {
  return REASON_SET.has(value);
}

export type QuestionReportValidationResult =
  | { ok: true; reasonCodes: QuestionReportReasonCode[]; customNote: string | null }
  | { ok: false; error: string };

export function validateQuestionReportInput(input: {
  reasonCodes: unknown;
  customNote?: unknown;
}): QuestionReportValidationResult {
  const rawCodes = Array.isArray(input.reasonCodes) ? input.reasonCodes : [];
  const reasonCodes = rawCodes
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter(isQuestionReportReasonCode);

  const uniqueCodes = [...new Set(reasonCodes)];

  if (uniqueCodes.length === 0) {
    return { ok: false, error: "Select at least one reason." };
  }

  const customNoteRaw =
    typeof input.customNote === "string" ? input.customNote.trim() : "";
  const customNote = customNoteRaw.length > 0 ? customNoteRaw.slice(0, 500) : null;

  if (uniqueCodes.length === 1 && uniqueCodes[0] === "other") {
    if (!customNote || customNote.length < 10) {
      return {
        ok: false,
        error: "Please provide a brief description (at least 10 characters) when selecting Other.",
      };
    }
  }

  return { ok: true, reasonCodes: uniqueCodes, customNote };
}
