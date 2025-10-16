const imgCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

function blobToImageURL(blob: Blob) {
  return URL.createObjectURL(blob);
}

async function loadViaFetchObjectURL(src: string): Promise<HTMLImageElement> {
  const r = await fetch(src, { credentials: 'omit', mode: 'cors' });
  if (!r.ok) throw new Error('fetch failed ' + r.status);
  const b = await r.blob();
  const url = blobToImageURL(b);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Loads an image as same-origin (no taint). Falls back to backend proxy if needed. */
export function loadTextureImage(src: string): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('empty src'));
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  if (inflight.has(src)) return inflight.get(src)!;

  const p = (async () => {
    try {
      const img = await loadViaFetchObjectURL(src);
      imgCache.set(src, img);
      return img;
    } catch {
      // fallback to proxy
      const API = import.meta.env.VITE_API_BASE_URL || '';
      const proxied = `${API}/api/texture?url=${encodeURIComponent(src)}`;
      const img = await loadViaFetchObjectURL(proxied);
      imgCache.set(src, img);
      return img;
    }
  })();

  inflight.set(src, p);
  return p.finally(() => inflight.delete(src));
}

/** Given desired world repeat (pixels), and source image size, compute Konva pattern scale. */
export function patternScaleFor(img: HTMLImageElement, repeatPx: number) {
  const repeat = Math.max(16, repeatPx);
  return { x: repeat / img.width, y: repeat / img.height };
}
