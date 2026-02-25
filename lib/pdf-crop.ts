/**
 * Crops a region from a source canvas and returns a data URL.
 * Uses clamping to ensure valid bounds (per PDF crop spec).
 */
export function cropCanvasToDataUrl(
  sourceCanvas: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
  mimeType: "image/png" | "image/jpeg" = "image/png"
): string {
  const clampedX = Math.max(0, Math.floor(rect.x));
  const clampedY = Math.max(0, Math.floor(rect.y));
  const clampedW = Math.min(Math.floor(rect.width), sourceCanvas.width - clampedX);
  const clampedH = Math.min(Math.floor(rect.height), sourceCanvas.height - clampedY);

  if (clampedW <= 0 || clampedH <= 0) return "";

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = clampedW;
  outputCanvas.height = clampedH;
  const ctx = outputCanvas.getContext("2d")!;
  ctx.drawImage(
    sourceCanvas,
    clampedX,
    clampedY,
    clampedW,
    clampedH,
    0,
    0,
    clampedW,
    clampedH
  );

  return mimeType === "image/jpeg"
    ? outputCanvas.toDataURL("image/jpeg", 0.92)
    : outputCanvas.toDataURL("image/png");
}
