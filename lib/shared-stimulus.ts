/**
 * Split AP-style shared-stimulus block headers ("This question refers to…")
 * from the actual MCQ stem. Used at PDF ingest and optionally on the exam page
 * for legacy rows where the model put both in question_text.
 */

export interface StemPartition {
  stem: string;
  intro: string | null;
}

/** Line that clearly begins the scored multiple-choice stem (not a block header). */
function isLikelyStemStartLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (
    /^\d+\.\s+(?:Which|What|How|If\b|Suppose|Consider|According|Based|Given|Select|Determine|For\s+the|All\s+of\s+the|Identify|Complete|The\s+following)/i.test(
      t
    )
  ) {
    return true;
  }
  if (/^(?:Which|What|How)\b/i.test(t) && /[?]\s*$/.test(t) && t.length < 900) {
    return true;
  }
  return false;
}

/** Heuristic: preceding lines look like a block / directions, not the scored stem. */
function blockIntroSignals(text: string): boolean {
  const lower = text.toLowerCase();
  if (/this\s+question\s+refers\s+to\b/.test(lower)) return true;
  if (/these\s+questions\s+refer\s+to\b/.test(lower)) return true;
  if (/questions\s+\d+[\u2013\-–]\s*\d+/.test(lower) && /refer\s+to\b/.test(lower)) return true;
  if (/questions\s+\d+\s+and\s+\d+/.test(lower) && /refer\s+to\b/.test(lower)) return true;
  if (/^directions?:\s/mi.test(text)) return true;
  if (/^use\s+the\s+(?:information|table|figure|graph|diagram|chart|data)\s+(?:above|below|in\b)/im.test(text)) {
    return true;
  }
  if (/^refer\s+to\s+the\s+(?:figure|graph|table|diagram|chart|information)/im.test(text)) return true;
  return false;
}

/**
 * If the first paragraph is only block context and the rest is the stem, split.
 * Otherwise returns stem = full trimmed text, intro = null.
 */
export function partitionStemAndSharedIntro(questionText: string): StemPartition {
  const full = questionText?.trim() ?? "";
  if (!full) return { stem: "", intro: null };

  const lines = full.split(/\r?\n/);
  let stemStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isLikelyStemStartLine(lines[i])) {
      stemStart = i;
      break;
    }
  }

  if (stemStart <= 0) {
    return { stem: full, intro: null };
  }

  const intro = lines.slice(0, stemStart).join("\n").trim();
  const stem = lines.slice(stemStart).join("\n").trim();

  if (!stem) {
    return { stem: full, intro: null };
  }

  if (!blockIntroSignals(intro)) {
    return { stem: full, intro: null };
  }

  return { stem, intro };
}
