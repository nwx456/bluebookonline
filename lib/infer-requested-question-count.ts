/**
 * Best-effort inference of user-entered question count from filename (legacy uploads only).
 * Returns null when confidence is low.
 */
export function inferRequestedQuestionCountFromFilename(
  filename: string
): number | null {
  const name = filename.trim();
  if (!name) return null;

  const base = name.replace(/\.pdf$/i, "");

  // 11.pdf, 40.pdf
  if (/^\d{1,3}$/.test(base)) {
    const n = parseInt(base, 10);
    if (n >= 1 && n <= 200) return n;
  }

  // CSA40.pdf, CSP40.pdf
  const csa = name.match(/\bCS[AP](\d{1,3})\b/i);
  if (csa) {
    const n = parseInt(csa[1], 10);
    if (n >= 1 && n <= 200) return n;
  }

  // Practice_statTest_40.pdf, statTest_40
  const underscoreNum = name.match(/(?:Test|Exam|Practice)[_\s-]*(\d{2,3})\b/i);
  if (underscoreNum) {
    const n = parseInt(underscoreNum[1], 10);
    if (n >= 10 && n <= 200) return n;
  }

  // Version 60, Version 11
  const version = name.match(/\bVersion[\s_-]*(\d{1,3})\b/i);
  if (version) {
    const n = parseInt(version[1], 10);
    if (n >= 1 && n <= 200) return n;
  }

  // sat-practice-test-10 — test number not question count; skip single digits after test-
  const satTest = name.match(/sat-practice-test-(\d+)/i);
  if (satTest) return null;

  return null;
}

export function resolveRequestedQuestionCount(opts: {
  stored: number | null | undefined;
  filename: string;
}): { value: number | null; source: "stored" | "inferred" | "unknown" } {
  if (opts.stored != null && Number.isFinite(Number(opts.stored)) && Number(opts.stored) > 0) {
    return { value: Number(opts.stored), source: "stored" };
  }
  const inferred = inferRequestedQuestionCountFromFilename(opts.filename);
  if (inferred != null) {
    return { value: inferred, source: "inferred" };
  }
  return { value: null, source: "unknown" };
}
