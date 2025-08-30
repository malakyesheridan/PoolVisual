const API = import.meta.env.VITE_API_BASE_URL || '';
const cache = new Map<string, HTMLImageElement>();

function blobToImageURL(blob: Blob) { return URL.createObjectURL(blob); }

async function loadBlobAsImage(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error('fetch ' + res.status);
  const blob = await res.blob();
  const obj = blobToImageURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = obj;
  });
}

export async function loadTextureImage(src: string): Promise<HTMLImageElement> {
  if (!src) throw new Error('empty src');
  if (cache.has(src)) return cache.get(src)!;
  try {
    const img = await loadBlobAsImage(src);
    cache.set(src, img);
    return img;
  } catch {
    const proxied = `${API}/api/texture?url=${encodeURIComponent(src)}`;
    const img = await loadBlobAsImage(proxied);
    cache.set(src, img);
    return img;
  }
}

/** Given desired world repeat (pixels), and source image size, compute Konva pattern scale. */
export function patternScaleFor(img: HTMLImageElement, repeatPx: number) {
  const repeat = Math.max(16, repeatPx);
  return { x: repeat / img.width, y: repeat / img.height };
}