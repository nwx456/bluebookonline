import type { SatSection } from "@/lib/exam-program";

type DedupeQuestion = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
  content?: string | null;
  question?: string | null;
};

function normalizeStem(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function stemKey(q: DedupeQuestion): string | null {
  const raw =
    (typeof q.content === "string" && q.content.trim()) ||
    (typeof q.question === "string" && q.question.trim()) ||
    "";
  // Very short stems are usually parse artifacts (e.g. "?") or grid-in prompts.
  // Skipping them here keeps positional duplicates from collapsing legit rows.
  if (raw.length < 8) return null;
  return normalizeStem(raw);
}

function sectionOf(q: DedupeQuestion): SatSection | null {
  const s = q.sat_section;
  return s === "rw" || s === "math" ? s : null;
}

function bucketDedupeKey(q: DedupeQuestion): string | null {
  const section = sectionOf(q);
  const stem = stemKey(q);
  if (!section || !stem) return null;
  const modId = q.sat_module ?? 0;
  const variant = q.sat_module_variant ?? "";
  return `${section}:${modId}:${variant}:${stem}`;
}

/**
 * Remove duplicate questions within the same module bucket (section + module + variant + stem).
 * Does not collapse M2 duplicates against M1.
 */
export function dedupeSatBucketQuestions<T extends DedupeQuestion>(questions: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const q of questions) {
    const key = bucketDedupeKey(q);
    if (!key) {
      out.push(q);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }

  return out;
}
