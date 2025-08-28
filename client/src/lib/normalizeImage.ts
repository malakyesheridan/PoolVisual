import * as exifr from 'exifr';
import { loadHtmlImage } from './loadHtmlImage';

/**
 * Normalize camera images from mobile:
 * - Correct EXIF orientation (via createImageBitmap or exifr fallback)
 * - Downscale to maxEdge (default 3000px) preserving aspect ratio
 * - Output JPEG Blob and final dimensions
 */
export async function normalizeImage(fileOrBlob: File | Blob, maxEdge = 3000): Promise<{ blob: Blob; width: number; height: number }> {
  const srcBlob = fileOrBlob instanceof File 
    ? new Blob([await fileOrBlob.arrayBuffer()], { type: fileOrBlob.type })
    : fileOrBlob;

  // Path A: modern browsers — honor EXIF using createImageBitmap options
  if ('createImageBitmap' in window) {
    try {
      // @ts-ignore: TS DOM lib may not include options
      const bmp = await createImageBitmap(srcBlob, { imageOrientation: 'from-image' });
      const { blob, width, height } = await drawToBlob(bmp, maxEdge);
      return { blob, width, height };
    } catch {
      // fall through
    }
  }

  // Path B: fallback — read EXIF orientation and rotate manually
  let orientation: number = 1;
  try {
    const exif = await exifr.parse(srcBlob, { tiff: true, ifd0: true });
    orientation = (exif && (exif.Orientation as number)) || 1;
  } catch {
    orientation = 1;
  }

  const objUrl = URL.createObjectURL(srcBlob);
  const htmlImg = await loadHtmlImage(objUrl, '');
  URL.revokeObjectURL(objUrl);

  const { canvas, ctx, targetW, targetH } = createCanvasForImage(htmlImg.naturalWidth, htmlImg.naturalHeight, orientation, maxEdge);
  applyOrientationDraw(ctx, htmlImg, orientation, targetW, targetH);

  const outBlob = await new Promise<Blob>((res) => (canvas as HTMLCanvasElement).toBlob(b => res(b!), 'image/jpeg', 0.9));
  const finalDims = getFinalDims(targetW, targetH, orientation);
  return { blob: outBlob, width: finalDims.width, height: finalDims.height };
}

async function drawToBlob(bmp: ImageBitmap, maxEdge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const tw = Math.round(bmp.width * scale);
  const th = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, tw, th);
  const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.9));
  return { blob, width: tw, height: th };
}

function createCanvasForImage(srcW: number, srcH: number, orientation: number, maxEdge: number) {
  const rotated = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  const baseW = rotated ? srcH : srcW;
  const baseH = rotated ? srcW : srcH;
  const scale = Math.min(1, maxEdge / Math.max(baseW, baseH));
  const targetW = Math.round(baseW * scale);
  const targetH = Math.round(baseH * scale);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, targetW, targetH };
}

function applyOrientationDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, orientation: number, targetW: number, targetH: number) {
  // Map EXIF orientation to canvas transforms
  switch (orientation) {
    case 2: // horizontal flip
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      break;
    case 3: // 180°
      ctx.translate(targetW, targetH);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      break;
    case 4: // vertical flip
      ctx.translate(0, targetH);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      break;
    case 5: // vertical flip + 90° CW
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, -targetH, targetW, targetH);
      break;
    case 6: // 90° CW
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -targetW);
      ctx.drawImage(img, 0, 0, targetH, targetW);
      break;
    case 7: // horizontal flip + 90° CW
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(targetH, -targetW);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, targetH, targetW);
      break;
    case 8: // 90° CCW
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-targetH, 0);
      ctx.drawImage(img, 0, 0, targetH, targetW);
      break;
    case 1:
    default:
      ctx.drawImage(img, 0, 0, targetW, targetH);
  }
}

function getFinalDims(targetW: number, targetH: number, orientation: number) {
  const rotated = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  return rotated ? { width: targetH, height: targetW } : { width: targetW, height: targetH };
}