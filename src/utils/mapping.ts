/**
 * Single source of truth for coordinate mapping
 * Exact inverse of the draw transform pipeline
 */

export interface Camera {
  scale: number;
  panX: number;
  panY: number;
}

export interface ImageFit {
  originX: number;
  originY: number;
  imgScale: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert screen coordinates to image coordinates
 * Exact inverse of: DPR → pan → scale → imgFit → draw
 */
export function screenToImage(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
  cam: Camera,
  dpr: number,
  img: ImageFit
): Point {
  const rect = viewportEl.getBoundingClientRect();
  const sx = (clientX - rect.left) * dpr;
  const sy = (clientY - rect.top) * dpr;
  const ix = ((sx - cam.panX) / cam.scale - img.originX) / img.imgScale;
  const iy = ((sy - cam.panY) / cam.scale - img.originY) / img.imgScale;
  return { x: ix, y: iy };
}

/**
 * Convert image coordinates to screen coordinates
 * Exact forward of: DPR → pan → scale → imgFit → draw
 */
export function imageToScreen(
  ix: number,
  iy: number,
  viewportEl: HTMLElement,
  cam: Camera,
  dpr: number,
  img: ImageFit
): Point {
  const rect = viewportEl.getBoundingClientRect();
  const sx = ((ix * img.imgScale + img.originX) * cam.scale + cam.panX) / dpr + rect.left;
  const sy = ((iy * img.imgScale + img.originY) * cam.scale + cam.panY) / dpr + rect.top;
  return { x: sx, y: sy };
}
