/**
 * PDF crop geometry helpers.
 * Single source of truth for bbox math used by PdfPageView and any other crop call site.
 *
 * Conventions:
 * - "Normalized" rect: x, y, width, height are 0..1 fractions of the page.
 * - "Pixel" rect: integer coordinates in the rendered canvas pixel space.
 * - Top-left origin (PDF crop convention used in this codebase).
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Stronger normalized detection than a naive `<= 1` check.
 * Considers a rect "normalized" only if all four numbers are within [0, 1.05]
 * and width/height are positive.
 */
export function isLikelyNormalized(r: Rect | null | undefined): boolean {
  if (!r) return false;
  const { x, y, width, height } = r;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  )
    return false;
  if (width <= 0 || height <= 0) return false;
  return (
    x >= -0.05 &&
    x <= 1.05 &&
    y >= -0.05 &&
    y <= 1.05 &&
    width <= 1.1 &&
    height <= 1.1
  );
}

/**
 * Convert a possibly-normalized rect to pixel coordinates of the rendered canvas.
 */
export function toPixelRect(r: Rect, fullW: number, fullH: number, normalized: boolean): Rect {
  if (normalized) {
    return {
      x: r.x * fullW,
      y: r.y * fullH,
      width: r.width * fullW,
      height: r.height * fullH,
    };
  }
  return { ...r };
}

/**
 * Clamp a pixel rect to [0, fullW] x [0, fullH].
 * Returns a safe rect; if the input is degenerate the return area may be 0.
 */
export function clampPixelRect(r: Rect, fullW: number, fullH: number): Rect {
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const w = Math.min(Math.floor(r.width), fullW - x);
  const h = Math.min(Math.floor(r.height), fullH - y);
  return { x, y, width: Math.max(0, w), height: Math.max(0, h) };
}

/**
 * Expand a pixel rect outward by a margin ratio (0.08 = 8% of width/height per side).
 * Result is clamped to the canvas bounds.
 */
export function expandPixelRect(
  r: Rect,
  marginRatio: number,
  fullW: number,
  fullH: number
): Rect {
  const dx = r.width * marginRatio;
  const dy = r.height * marginRatio;
  const x = r.x - dx;
  const y = r.y - dy;
  const w = r.width + dx * 2;
  const h = r.height + dy * 2;
  return clampPixelRect({ x, y, width: w, height: h }, fullW, fullH);
}

/**
 * Ensure the rect covers at least `minFraction` of the page area.
 * If too small, grow uniformly around its center until either the area or one
 * dimension hits a sane minimum.
 */
export function ensureMinCropArea(
  r: Rect,
  minFraction: number,
  fullW: number,
  fullH: number
): Rect {
  const pageArea = fullW * fullH;
  const targetArea = pageArea * minFraction;
  const currentArea = Math.max(1, r.width * r.height);
  if (currentArea >= targetArea) return r;

  const scale = Math.sqrt(targetArea / currentArea);
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const w = r.width * scale;
  const h = r.height * scale;
  const x = cx - w / 2;
  const y = cy - h / 2;
  return clampPixelRect({ x, y, width: w, height: h }, fullW, fullH);
}

export interface PrepareCropOptions {
  /** Per-side margin as ratio of bbox dimensions (default 0.10 = 10%). */
  marginRatio?: number;
  /** Minimum fraction of the page area the crop should cover (default 0.04 = 4%). */
  minAreaFraction?: number;
  /** Minimum short-edge in pixels; if crop's shortest side is below this, widen. */
  minShortEdgePx?: number;
}

export interface PrepareCropResult {
  /** Final pixel rect to crop. */
  rect: Rect;
  /** True if the bbox was widened beyond the original. */
  widened: boolean;
  /** True if the bbox was abandoned (caller should fall back to full-page). */
  fellBack: boolean;
}

/**
 * High-level: take an AI-supplied bbox plus the rendered canvas dimensions and
 * produce a safe pixel rect to crop, optionally falling back to full-page when
 * the rect is implausible.
 */
export function prepareCropRect(
  bbox: Rect,
  fullW: number,
  fullH: number,
  options: PrepareCropOptions = {}
): PrepareCropResult {
  const marginRatio = options.marginRatio ?? 0.1;
  const minAreaFraction = options.minAreaFraction ?? 0.04;
  const minShortEdgePx = options.minShortEdgePx ?? 96;

  const normalized = isLikelyNormalized(bbox);
  const pixel = toPixelRect(bbox, fullW, fullH, normalized);
  const baseClamped = clampPixelRect(pixel, fullW, fullH);

  if (baseClamped.width <= 0 || baseClamped.height <= 0) {
    return {
      rect: { x: 0, y: 0, width: fullW, height: fullH },
      widened: false,
      fellBack: true,
    };
  }

  let rect = expandPixelRect(baseClamped, marginRatio, fullW, fullH);
  rect = ensureMinCropArea(rect, minAreaFraction, fullW, fullH);

  const shortEdge = Math.min(rect.width, rect.height);
  let widened = rect.width > baseClamped.width || rect.height > baseClamped.height;
  let fellBack = false;

  if (shortEdge < minShortEdgePx) {
    const widerMargin = Math.max(marginRatio, 0.25);
    rect = expandPixelRect(baseClamped, widerMargin, fullW, fullH);
    rect = ensureMinCropArea(rect, Math.max(minAreaFraction, 0.08), fullW, fullH);
    widened = true;
    if (Math.min(rect.width, rect.height) < Math.max(48, minShortEdgePx / 2)) {
      rect = { x: 0, y: 0, width: fullW, height: fullH };
      fellBack = true;
    }
  }

  return { rect, widened, fellBack };
}
