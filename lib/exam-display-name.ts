const MAX_DISPLAY_TITLE_LEN = 200;

export function getMcqExamDisplayName(params: {
  displayTitle?: string | null;
  filename?: string | null;
  fallback?: string;
}): string {
  const display = params.displayTitle?.trim();
  if (display) return display;
  const filename = params.filename?.trim();
  if (filename) return filename;
  return params.fallback ?? "PDF";
}

export function getFrqExamDisplayName(params: {
  displayTitle?: string | null;
  title?: string | null;
  fallback?: string;
}): string {
  const display = params.displayTitle?.trim();
  if (display) return display;
  const title = params.title?.trim();
  if (title) return title;
  return params.fallback ?? "FRQ Exam";
}

export function normalizeDisplayTitleInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_DISPLAY_TITLE_LEN) {
    throw new Error(`Display title must be at most ${MAX_DISPLAY_TITLE_LEN} characters.`);
  }
  return trimmed;
}
