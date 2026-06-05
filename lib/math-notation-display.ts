import { isSatMath, type SatSection } from "@/lib/exam-program";

const SUPERSCRIPT_CHARS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
};

const SUBSCRIPT_CHARS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

function mapToScript(value: string, table: Record<string, string>): string {
  return [...value]
    .map((ch) => table[ch] ?? table[ch.toLowerCase()] ?? ch)
    .join("");
}

function replaceExponents(text: string): string {
  return text.replace(
    /\^\s*(\{([^{}]+)\}|\(([^()]+)\)|(-?\d+)|([a-zA-Z]))/g,
    (_match, _group, braced, parens, numeric, letter) => {
      const exponent = braced ?? parens ?? numeric ?? letter ?? "";
      return mapToScript(exponent, SUPERSCRIPT_CHARS);
    }
  );
}

function replaceSubscripts(text: string): string {
  return text.replace(
    /_\s*(\{([^{}]+)\}|\(([^()]+)\)|(-?\d+)|([a-zA-Z]))/g,
    (_match, _group, braced, parens, numeric, letter) => {
      const subscript = braced ?? parens ?? numeric ?? letter ?? "";
      return mapToScript(subscript, SUBSCRIPT_CHARS);
    }
  );
}

function replaceMathSymbols(text: string): string {
  let out = text;
  out = out.replace(/\bsqrt\s*\(([^)]+)\)/gi, "√($1)");
  out = out.replace(/\bpi\b/gi, "π");
  out = out.replace(/<=/g, "≤");
  out = out.replace(/>=/g, "≥");
  out = out.replace(/!=/g, "≠");
  out = out.replace(/<>/g, "≠");
  out = out.replace(/\binfty\b/gi, "∞");
  out = out.replace(/\+\-/g, "±");
  out = out.replace(/\-\+/g, "±");
  return out;
}

/** Whether caret/subscript math notation should be prettified for display. */
export function shouldFormatMathNotation(
  subject: string | null | undefined,
  satSection?: SatSection | null
): boolean {
  if (satSection === "math") return true;
  if (satSection === "rw") return false;
  return isSatMath(subject);
}

/**
 * Converts lightweight math markup (x^2, x_{1}, sqrt(x), pi) into readable Unicode
 * notation for SAT Math question display.
 */
export function formatMathNotation(text: string | null | undefined): string {
  if (!text) return text ?? "";
  if (!/[\^_]|sqrt|<=|>=|!=|<>|infty|\bpi\b/i.test(text)) return text;

  let out = text;
  out = replaceExponents(out);
  out = replaceSubscripts(out);
  out = replaceMathSymbols(out);
  return out;
}

export function formatMathTextIfNeeded(
  text: string | null | undefined,
  enabled: boolean
): string {
  if (!text) return text ?? "";
  return enabled ? formatMathNotation(text) : text;
}
