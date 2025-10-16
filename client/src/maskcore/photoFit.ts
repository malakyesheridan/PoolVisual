/**
 * PHASE 2 - Camera + Image Fit (explicit)
 * Compute exact image fit values the mapper needs
 */

export interface ImageFit {
  originX: number;
  originY: number;
  imgScale: number;
}

export interface Camera {
  scale: number;
  panX: number;
  panY: number;
}

/**
 * Calculate image fit parameters for a given image and canvas dimensions
 * Returns values such that the photo is drawn at:
 * drawImage(photo, 0, 0, imgW, imgH) in image space,
 * after translate(originX, originY); scale(imgScale, imgScale); 
 * it perfectly fits inside the canvas viewport
 */
export function calculateImageFit(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
  cameraScale: number = 1
): ImageFit {
  if (imgW <= 0 || imgH <= 0 || canvasW <= 0 || canvasH <= 0) {
    return { originX: 0, originY: 0, imgScale: 1 };
  }

  // Calculate scale to fit image in canvas (contain mode)
  const scaleX = canvasW / imgW;
  const scaleY = canvasH / imgH;
  const scale = Math.min(scaleX, scaleY);

  // Calculate scaled dimensions
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;

  // Calculate offset to center the image
  const offsetX = (canvasW - scaledW) / 2;
  const offsetY = (canvasH - scaledH) / 2;

  return {
    originX: offsetX / cameraScale,
    originY: offsetY / cameraScale,
    imgScale: 1.0 // No additional scaling beyond camera scale
  };
}

/**
 * Get image fit parameters for current state
 * This is the single source of truth for image fit calculations
 */
export function getImageFit(
  imageRef: React.RefObject<HTMLImageElement>,
  canvasW: number,
  canvasH: number,
  cameraScale: number = 1
): ImageFit {
  if (!imageRef.current) {
    return { originX: 0, originY: 0, imgScale: 1 };
  }

  return calculateImageFit(
    imageRef.current.naturalWidth,
    imageRef.current.naturalHeight,
    canvasW,
    canvasH,
    cameraScale
  );
}
