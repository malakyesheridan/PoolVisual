// 2) Single inverse mapping (used everywhere)
// Create coord.ts and export ONLY these two functions; replace all ad-hoc mappers (masks, assets, pools)

export interface Camera {
  scale: number;
  panX: number;
  panY: number;
}

export interface ImageParams {
  originX: number;
  originY: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MouseEvent {
  clientX: number;
  clientY: number;
}

/**
 * screenToImage(clientX, clientY, viewportEl, cam, DPR, img):
 * rect = viewportEl.getBoundingClientRect()
 * sx = (clientX - rect.left) * DPR
 * sy = (clientY - rect.top) * DPR
 * ix = ( (sx - cam.panX) / cam.scale - img.originX ) / img.scale
 * iy = ( (sy - cam.panY) / cam.scale - img.originY ) / img.scale
 * return { ix, iy }
 */
export function screenToImage(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
  cam: Camera,
  DPR: number,
  img: ImageParams = { originX: 0, originY: 0, scale: 1 }
): Point {
  const rect = viewportEl.getBoundingClientRect();
  const sx = (clientX - rect.left) * DPR;
  const sy = (clientY - rect.top) * DPR;
  const ix = ((sx - cam.panX) / cam.scale - img.originX) / img.scale;
  const iy = ((sy - cam.panY) / cam.scale - img.originY) / img.scale;
  return { x: ix, y: iy };
}

/**
 * imageToScreen(ix, iy, viewportEl, cam, DPR, img):
 * rect = viewportEl.getBoundingClientRect()
 * sx = (( (ix * img.scale + img.originX) * cam.scale ) + cam.panX) / DPR + rect.left
 * sy = (( (iy * img.scale + img.originY) * cam.scale ) + cam.panY) / DPR + rect.top
 * return { sx, sy }
 */
export function imageToScreen(
  ix: number,
  iy: number,
  viewportEl: HTMLElement,
  cam: Camera,
  DPR: number,
  img: ImageParams = { originX: 0, originY: 0, scale: 1 }
): Point {
  const rect = viewportEl.getBoundingClientRect();
  const sx = ((ix * img.scale + img.originX) * cam.scale + cam.panX) / DPR + rect.left;
  const sy = ((iy * img.scale + img.originY) * cam.scale + cam.panY) / DPR + rect.top;
  return { x: sx, y: sy };
}

/**
 * Clamp image coordinates to image bounds
 */
export function clampToImageBounds(point: Point, imgW: number, imgH: number): Point {
  return {
    x: Math.max(0, Math.min(point.x, imgW)),
    y: Math.max(0, Math.min(point.y, imgH))
  };
}

/**
 * Check if a point is within image bounds
 */
export function isWithinImageBounds(point: Point, imgW: number, imgH: number): boolean {
  return point.x >= 0 && point.x <= imgW && point.y >= 0 && point.y <= imgH;
}

/**
 * Validate that coordinates are finite numbers
 */
export function isValidPoint(point: Point): boolean {
  return isFinite(point.x) && isFinite(point.y) && !isNaN(point.x) && !isNaN(point.y);
}
