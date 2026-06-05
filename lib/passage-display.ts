/**
 * Parse passage / stimulus text for exam left-panel display.
 * SAT R&W often stores bullet notes inline: "notes: • item • item".
 */

export type BulletPassage = {
  kind: "bullets";
  intro: string | null;
  items: string[];
};

export type PlainPassage = {
  kind: "plain";
  text: string;
};

export type ParsedPassage = BulletPassage | PlainPassage;

const BULLET_LINE_RE = /^[\u2022•\-*]\s+/;
const INLINE_BULLET_SPLIT = /\s*[\u2022•]\s+/;

/** Split inline or line-based bullet passages into intro + list items. */
export function parseBulletPassage(text: string): ParsedPassage {
  const t = text.trim();
  if (!t) return { kind: "plain", text: t };

  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => BULLET_LINE_RE.test(l));
  if (bulletLines.length >= 2) {
    const introLines = lines.filter((l) => !BULLET_LINE_RE.test(l));
    return {
      kind: "bullets",
      intro: introLines.length > 0 ? introLines.join("\n") : null,
      items: bulletLines.map((l) => l.replace(BULLET_LINE_RE, "").trim()),
    };
  }

  if (/[\u2022•]/.test(t)) {
    const parts = t.split(INLINE_BULLET_SPLIT).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        kind: "bullets",
        intro: parts[0],
        items: parts.slice(1),
      };
    }
  }

  return { kind: "plain", text: t };
}
