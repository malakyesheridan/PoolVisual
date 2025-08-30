export type TextureMeta = {
  scale: number;         // base scale applied to both axes (image px -> world px)
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
};

export function pickRepeatMeters(material: {
  physical_repeat_m?: number | null;
  sheet_width_mm?: number | null;
  tile_width_mm?: number | null;
}) {
  // Prefer explicit physical repeat (meters), else sheet width, else tile width, else 0.3m fallback.
  if (material.physical_repeat_m && material.physical_repeat_m > 0) return material.physical_repeat_m;
  if (material.sheet_width_mm && material.sheet_width_mm > 0) return material.sheet_width_mm / 1000;
  if (material.tile_width_mm && material.tile_width_mm > 0) return material.tile_width_mm / 1000;
  return 0.30; // sensible default for mosaics
}

const imgCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function preloadImage(url: string): Promise<HTMLImageElement> {
  if (!url) return Promise.reject(new Error('empty texture url'));
  if (imgCache.has(url)) return Promise.resolve(imgCache.get(url)!);
  if (inflight.has(url)) return inflight.get(url)!;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgCache.set(url, img);
      inflight.delete(url);
      resolve(img);
    };
    img.onerror = (e) => {
      inflight.delete(url);
      reject(new Error(`image load failed: ${url}`));
    };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
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