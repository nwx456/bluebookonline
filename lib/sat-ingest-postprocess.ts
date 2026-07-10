/**
 * SAT-only post-processing for PDF extraction rows (not applied to AP).
 */

const GRAPH_KEYWORDS =
  /\b(graph|figure|diagram|chart|coordinate|plot|scatter|parabola|shown below|shown above|table above|table below)\b/i;
const SVG_MARKERS = /<svg\b/i;
const GRID_IN_STEM =
  /\b(enter your answer|grid your answer|student-produced|grid-in|grid in|type your answer|write your answer)\b/i;

export function looksLikeGraphDescription(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SVG_MARKERS.test(t)) return true;
  return GRAPH_KEYWORDS.test(t);
}

export function looksLikeGridInStem(stem: string): boolean {
  return GRID_IN_STEM.test(stem.trim());
}

export function isPlaceholderMcqOptions(options: unknown): boolean {
  if (!Array.isArray(options) || options.length !== 4) return false;
  const letters = options.map((o) => String(o ?? "").trim().toUpperCase());
  return (
    letters.join(",") === "A,B,C,D" ||
    letters.every((l, i) => l === ["A", "B", "C", "D"][i])
  );
}

export interface SatGeminiQuestion {
  content?: string | null;
  question?: string | null;
  image_description?: string | null;
  has_graph?: boolean;
  page_number?: number | null;
  question_type?: string | null;
  options?: unknown;
}

/** SAT-only: infer grid-in, strip fake options, boost has_graph from page + keywords. */
export function applySatIngestPostProcess(
  q: SatGeminiQuestion,
  opts?: { section?: "rw" | "math" | null }
): void {
  const stem = (
    typeof q.content === "string"
      ? q.content
      : typeof q.question === "string"
        ? q.question
        : ""
  ).trim();

  const desc = (q.image_description ?? "").trim();
  const isRw = opts?.section === "rw";

  // R&W is MCQ-only. Math can be grid-in: infer once from stem or explicit tag.
  if (!isRw) {
    const isGridIn =
      q.question_type === "grid_in" ||
      looksLikeGridInStem(stem) ||
      (isPlaceholderMcqOptions(q.options) && looksLikeGridInStem(stem));
    if (isGridIn) {
      q.question_type = "grid_in";
      q.options = [];
    }
  }

  const pageNum =
    q.page_number != null && Number.isInteger(Number(q.page_number))
      ? Number(q.page_number)
      : null;

  if (!q.has_graph && pageNum != null) {
    if (looksLikeGraphDescription(stem) || looksLikeGraphDescription(desc)) {
      q.has_graph = true;
    }
  }

  if (q.has_graph === true && desc && looksLikeGraphDescription(desc)) {
    q.image_description = null;
  }
}

function isSatRwPassageLine(t: string): boolean {
  if (!t) return false;
  return (
    /^(\u2022|[-*•]|\d+\.)\s+/u.test(t) ||
    /^[IVX]+\.\s+/i.test(t) ||
    (t.length > 120 && !/\?\s*$/.test(t))
  );
}

function isSatRwStemLine(t: string): boolean {
  if (!t) return false;
  return (
    /^(Which|What|How|As used in|Based on|According to|The author|Which choice)/i.test(t) ||
    (/\?\s*$/.test(t) && t.length < 400)
  );
}

/**
 * R&W: if question_text has 2+ paragraphs before the stem, treat them as passage.
 */
function partitionSatRwMultiParagraph(
  full: string,
  existingPassage: string | null
): { stem: string; passage: string | null } | null {
  const blocks = full.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 2) return null;

  let stemIdx = -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (isSatRwStemLine(b) && !isSatRwPassageLine(b.split(/\r?\n/)[0]?.trim() ?? "")) {
      stemIdx = i;
      break;
    }
  }
  if (stemIdx <= 0) {
    const last = blocks[blocks.length - 1];
    if (isSatRwStemLine(last) && blocks.length >= 2) {
      stemIdx = blocks.length - 1;
    } else {
      return null;
    }
  }

  const passageBlocks = blocks.slice(0, stemIdx);
  const stemBlocks = blocks.slice(stemIdx);
  if (passageBlocks.length === 0) return null;

  const added = passageBlocks.join("\n\n").trim();
  const stem = stemBlocks.join("\n\n").trim() || full;
  const passage = existingPassage?.trim()
    ? `${added}\n\n${existingPassage.trim()}`
    : added;

  return { stem, passage: passage || existingPassage };
}

/** SAT R&W / Math: move bullet lists and table fragments from stem to passage. */
export function partitionSatStemAndPassage(
  questionText: string,
  existingPassage: string | null,
  satSection: "rw" | "math" | null
): { stem: string; passage: string | null } {
  const full = questionText.trim();
  if (!full) return { stem: full, passage: existingPassage };

  if (satSection === "rw") {
    const multi = partitionSatRwMultiParagraph(full, existingPassage);
    if (multi) return multi;
  }

  const lines = full.split(/\r?\n/);
  const passageLines: string[] = [];
  const stemLines: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    const isListOrPassage =
      satSection === "rw"
        ? isSatRwPassageLine(t)
        : satSection === "math"
          ? /^\|/.test(t) ||
            /^<table/i.test(t) ||
            (t.includes("|") && t.split("|").length >= 3)
          : false;

    if (isListOrPassage && stemLines.length === 0) {
      passageLines.push(line);
    } else {
      stemLines.push(line);
    }
  }

  if (passageLines.length === 0) {
    return { stem: full, passage: existingPassage };
  }

  const stem = stemLines.join("\n").trim() || full;
  const added = passageLines.join("\n").trim();
  const passage = existingPassage?.trim()
    ? `${added}\n\n${existingPassage.trim()}`
    : added;

  return { stem, passage: passage || existingPassage };
}
