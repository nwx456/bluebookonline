import type { SatSection } from "@/lib/exam-program";
import {
  inferModuleNumberFromLabel,
  inferVariantFromLabel,
} from "@/lib/sat-module-normalizer";

type DedupeQuestion = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
  sat_pdf_module_label?: string | null;
  pdf_module_label?: string | null;
  content?: string | null;
  question?: string | null;
  image_description?: string | null;
  options?: unknown;
  accepted_answers?: string[] | null;
};

const PASSAGE_KEY_LEN = 300;

function normalizeFingerprint(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function stemKey(q: DedupeQuestion): string | null {
  const raw =
    (typeof q.content === "string" && q.content.trim()) ||
    (typeof q.question === "string" && q.question.trim()) ||
    "";
  if (raw.length < 8) return null;
  return normalizeFingerprint(raw);
}

function optionsFingerprint(options: unknown): string {
  if (!Array.isArray(options)) return "";
  return options
    .map((o) => (typeof o === "string" ? o.trim() : String(o ?? "").trim()))
    .join("|");
}

function passageKey(q: DedupeQuestion): string {
  const raw =
    typeof q.image_description === "string" ? q.image_description : "";
  return normalizeFingerprint(raw.slice(0, PASSAGE_KEY_LEN));
}

function answersFingerprint(q: DedupeQuestion): string {
  if (!Array.isArray(q.accepted_answers)) return "";
  return q.accepted_answers.map((a) => String(a).trim()).join("|");
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

  if (section === "rw") {
    const passage = passageKey(q);
    const opts = normalizeFingerprint(optionsFingerprint(q.options));
    return `${section}:${modId}:${variant}:${stem}:${passage}:${opts}`;
  }

  const opts = normalizeFingerprint(optionsFingerprint(q.options));
  const answers = normalizeFingerprint(answersFingerprint(q));
  const extra = opts || answers;
  return `${section}:${modId}:${variant}:${stem}:${extra}`;
}

/**
 * Section-level fingerprint ignoring module/variant tags.
 * Used to detect the same PDF question assigned to multiple buckets.
 */
export function sectionCrossBucketFingerprint(
  q: DedupeQuestion,
  sectionOverride?: SatSection
): string | null {
  const section = sectionOverride ?? sectionOf(q);
  const stem = stemKey(q);
  if (!section || !stem) return null;

  if (section === "rw") {
    const passage = passageKey(q);
    const opts = normalizeFingerprint(optionsFingerprint(q.options));
    return `${section}:${stem}:${passage}:${opts}`;
  }

  const opts = normalizeFingerprint(optionsFingerprint(q.options));
  const answers = normalizeFingerprint(answersFingerprint(q));
  const extra = opts || answers;
  return `${section}:${stem}:${extra}`;
}

function pickPdfLabel(q: DedupeQuestion): string {
  const raw =
    (typeof q.sat_pdf_module_label === "string" && q.sat_pdf_module_label.trim()) ||
    (typeof q.pdf_module_label === "string" && q.pdf_module_label.trim()) ||
    "";
  if (!raw || raw.toLowerCase() === "unknown") return "";
  return raw;
}

/** Higher score = better canonical owner for a cross-bucket duplicate group. */
function labelBucketMatchScore(q: DedupeQuestion): number {
  const label = pickPdfLabel(q);
  if (!label) return 0;

  const inferredMod = inferModuleNumberFromLabel(label);
  const inferredVar = inferVariantFromLabel(label);
  const mod = q.sat_module === 1 || q.sat_module === 2 ? q.sat_module : null;
  const variant =
    q.sat_module_variant === "easy" || q.sat_module_variant === "hard"
      ? q.sat_module_variant
      : null;

  let score = 0;
  if (inferredMod != null && mod != null) {
    if (inferredMod === mod) score += 4;
    else score -= 12;
  }
  if (inferredVar != null && variant != null) {
    if (inferredVar === variant) score += 4;
    else score -= 12;
  } else if (inferredVar != null && mod === 1) {
    score -= 8;
  }

  return score;
}

function bucketOrderPriority(q: DedupeQuestion): number {
  const mod = q.sat_module ?? 99;
  if (mod === 1) return 0;
  if (q.sat_module_variant === "easy") return 1;
  if (q.sat_module_variant === "hard") return 2;
  return 3;
}

function pickCanonicalQuestion<T extends DedupeQuestion>(
  group: T[],
  firstIndex: Map<T, number>
): T {
  let best = group[0];
  let bestScore = labelBucketMatchScore(best);
  let bestOrder = bucketOrderPriority(best);
  let bestIdx = firstIndex.get(best) ?? 0;

  for (let i = 1; i < group.length; i++) {
    const candidate = group[i];
    const score = labelBucketMatchScore(candidate);
    const order = bucketOrderPriority(candidate);
    const idx = firstIndex.get(candidate) ?? i;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
      bestOrder = order;
      bestIdx = idx;
      continue;
    }
    if (score < bestScore) continue;

    if (order < bestOrder) {
      best = candidate;
      bestOrder = order;
      bestIdx = idx;
      continue;
    }
    if (order > bestOrder) continue;

    if (idx < bestIdx) {
      best = candidate;
      bestIdx = idx;
    }
  }

  return best;
}

export interface CrossBucketDedupeResult<T extends DedupeQuestion> {
  kept: T[];
  dropped: number;
}

/**
 * Collapse the same stem/passage/options appearing in multiple module buckets
 * within one SAT section. Keeps the copy whose PDF label best matches its bucket.
 */
export function dedupeSatSectionCrossBucketQuestions<T extends DedupeQuestion>(
  questions: T[]
): CrossBucketDedupeResult<T> {
  const groups = new Map<string, T[]>();
  const firstIndex = new Map<T, number>();
  const noFingerprint: T[] = [];

  questions.forEach((q, index) => {
    firstIndex.set(q, index);
    const fp = sectionCrossBucketFingerprint(q);
    if (!fp) {
      noFingerprint.push(q);
      return;
    }
    const list = groups.get(fp) ?? [];
    list.push(q);
    groups.set(fp, list);
  });

  const kept: T[] = [...noFingerprint];
  let dropped = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    kept.push(pickCanonicalQuestion(group, firstIndex));
    dropped += group.length - 1;
  }

  kept.sort((a, b) => (firstIndex.get(a) ?? 0) - (firstIndex.get(b) ?? 0));
  return { kept, dropped };
}

/**
 * Remove duplicate questions within the same module bucket.
 * R&W: stem + passage + options must all match to collapse.
 * Math: stem + options (or accepted_answers for grid-in) must match.
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
