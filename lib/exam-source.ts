export const EXAM_SOURCE_TYPES = ["book", "agency", "school"] as const;
export type ExamSourceType = (typeof EXAM_SOURCE_TYPES)[number];

const MAX_SOURCE_NAME_LEN = 200;
const MAX_SOURCE_URL_LEN = 2048;

export const EXAM_SOURCE_TYPE_LABELS: Record<ExamSourceType, string> = {
  book: "Published book / study guide",
  agency: "Test prep agency / course provider",
  school: "My school / my own materials",
};

/** Stored when the user picks school without entering a custom name. */
export const SCHOOL_SOURCE_DEFAULT_NAME = "Personal or school materials";

export type ValidatedExamSource = {
  sourceType: ExamSourceType;
  sourceName: string;
  sourceUrl: string | null;
  notOfficialConfirmed: boolean;
};

export type ExamSourceValidationResult =
  | { ok: true; normalized: ValidatedExamSource }
  | { ok: false; error: string };

function isExamSourceType(value: string): value is ExamSourceType {
  return (EXAM_SOURCE_TYPES as readonly string[]).includes(value);
}

export function validateExamSource(input: {
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  notOfficialConfirmed?: boolean;
}): ExamSourceValidationResult {
  const sourceType = input.sourceType?.trim().toLowerCase();
  if (!sourceType || !isExamSourceType(sourceType)) {
    return { ok: false, error: "Please select an exam source type." };
  }

  const rawName = input.sourceName?.trim() ?? "";
  const sourceName =
    sourceType === "school" && !rawName ? SCHOOL_SOURCE_DEFAULT_NAME : rawName;
  if (!sourceName) {
    return { ok: false, error: "Source name is required." };
  }
  if (sourceName.length > MAX_SOURCE_NAME_LEN) {
    return {
      ok: false,
      error: `Source name must be at most ${MAX_SOURCE_NAME_LEN} characters.`,
    };
  }

  let sourceUrl: string | null = null;
  if (sourceType === "book" || sourceType === "agency") {
    const rawUrl = input.sourceUrl?.trim() ?? "";
    if (!rawUrl) {
      return {
        ok: false,
        error: "A source URL is required for books and agencies.",
      };
    }
    if (rawUrl.length > MAX_SOURCE_URL_LEN) {
      return { ok: false, error: "Source URL is too long." };
    }
    if (!rawUrl.startsWith("https://")) {
      return { ok: false, error: "Source URL must start with https://." };
    }
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:") {
        return { ok: false, error: "Source URL must use HTTPS." };
      }
      sourceUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Source URL is not valid." };
    }
  }

  return {
    ok: true,
    normalized: {
      sourceType,
      sourceName,
      sourceUrl,
      notOfficialConfirmed: true,
    },
  };
}

export function parseExamSourceFields(raw: {
  sourceType?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  notOfficialConfirmed?: unknown;
}): ExamSourceValidationResult {
  return validateExamSource({
    sourceType: typeof raw.sourceType === "string" ? raw.sourceType : "",
    sourceName: typeof raw.sourceName === "string" ? raw.sourceName : "",
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : undefined,
  });
}

export type SourceAttributionDisplay = {
  text: string;
  url: string | null;
  linkLabel: string | null;
  sourceType: ExamSourceType;
  sourceName: string;
};

export function formatSourceLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const display = `${parsed.hostname}${path}`;
    return display.length > 56 ? `${display.slice(0, 53)}…` : display;
  } catch {
    return url.length > 56 ? `${url.slice(0, 53)}…` : url;
  }
}

export function formatSourceAttribution(row: {
  source_type: string | null;
  source_name: string | null;
  source_url?: string | null;
}): SourceAttributionDisplay | null {
  const sourceType = row.source_type?.trim().toLowerCase();
  const sourceName = row.source_name?.trim();
  if (!sourceType || !sourceName || !isExamSourceType(sourceType)) {
    return null;
  }

  const url =
    sourceType === "school" ? null : row.source_url?.trim() || null;

  const text =
    sourceType === "school"
      ? sourceName === SCHOOL_SOURCE_DEFAULT_NAME
        ? "Questions adapted from personal or school-provided materials"
        : `Questions adapted from materials provided by ${sourceName}`
      : `Questions adapted from ${sourceName}`;

  return {
    text,
    url,
    linkLabel: url ? formatSourceLinkLabel(url) : null,
    sourceType,
    sourceName,
  };
}

export function sourceTypeShortLabel(type: ExamSourceType): string {
  if (type === "book") return "Book";
  if (type === "agency") return "Agency";
  return "School";
}
