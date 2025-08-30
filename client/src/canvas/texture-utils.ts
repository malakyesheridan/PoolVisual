export type TextureMeta = { scale:number; rotationDeg:number; offsetX:number; offsetY:number };

export function pickRepeatMeters(m: {
  physical_repeat_m?: number|null;
  sheet_width_mm?: number|null;
  tile_width_mm?: number|null;
}) {
  if (m.physical_repeat_m && m.physical_repeat_m > 0) return m.physical_repeat_m;
  if (m.sheet_width_mm && m.sheet_width_mm > 0) return m.sheet_width_mm / 1000;
  if (m.tile_width_mm && m.tile_width_mm > 0) return m.tile_width_mm / 1000;
  return 0.3; // sensible fallback
}

const cache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function preloadImage(url: string) {
  if (!url) return Promise.reject(new Error('empty texture url'));
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  if (inflight.has(url)) return inflight.get(url)!;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { cache.set(url, img); inflight.delete(url); resolve(img); };
    img.onerror = () => { inflight.delete(url); reject(new Error('image load failed: ' + url)); };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
}

export function computePatternScale(img: HTMLImageElement, repeatPx: number) {
  const repeat = Math.max(16, repeatPx); // clamp
  return { x: repeat / img.width, y: repeat / img.height };
}