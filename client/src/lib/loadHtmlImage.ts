export async function loadHtmlImage(src: string, crossOrigin: 'anonymous' | '' = 'anonymous'): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (crossOrigin) img.crossOrigin = crossOrigin as any; // keep canvas untainted for CORS-safe URLs
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${src}`));
    img.src = src;
  });
}