export type TextureMeta = {
  scale: number;         // base scale applied to both axes (image px -> world px)
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
};

export function pickRepeatMeters(material: {
  physicalRepeatM?: number | null;
  sheetWidthMm?: number | null;
  tileWidthMm?: number | null;
}) {
  // Prefer explicit physical repeat (meters), else sheet width, else tile width, else 0.3m fallback.
  if (material.physicalRepeatM && material.physicalRepeatM > 0) return material.physicalRepeatM;
  if (material.sheetWidthMm && material.sheetWidthMm > 0) return material.sheetWidthMm / 1000;
  if (material.tileWidthMm && material.tileWidthMm > 0) return material.tileWidthMm / 1000;
  return 0.30; // sensible default for mosaics
}

/**
 * Compute Konva fillPatternScale values so that one pattern tile spans `repeatPx` pixels in world space.
 * If the source image is W×H px, scaleX = repeatPx / W (and same for Y).
 */
export function computePatternScale(img: HTMLImageElement, repeatPx: number) {
  const sx = repeatPx / img.width;
  const sy = repeatPx / img.height;
  return { x: sx, y: sy };
}

export function patternScaleFor(img: HTMLImageElement, repeatPx: number): { x: number; y: number } {
  const repeat = Math.max(16, repeatPx);
  return { x: repeat / img.width, y: repeat / img.height };
}
