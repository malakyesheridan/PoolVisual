import { imageToScreen, screenToImage } from '../utils/mapping';

type Camera = { scale:number; panX:number; panY:number };
type Fit = { originX:number; originY:number; imgScale:number };

export type Projector = {
  toLocalFromImage(ix:number, iy:number): { x:number; y:number };
};

/**
 * Self-calibrates whether imageToScreen returns CLIENT or LOCAL coords by
 * round-tripping with screenToImage and comparing error.
 * Then always returns LOCAL viewport coordinates for plotting.
 */
export function makeOverlayProjector(
  viewportEl: HTMLElement,
  camera: Camera,
  dpr: number,
  imgFit: Fit
): Projector {
  // Calibrate with a stable sample in image space.
  const sample = { x: 100, y: 100 };
  const client = imageToScreen(sample.x, sample.y, viewportEl, camera, dpr, imgFit);
  const rect = viewportEl.getBoundingClientRect();

  // Two hypotheses:
  // H1: imageToScreen returns CLIENT coords.
  const rtClient = screenToImage(client.x, client.y, viewportEl, camera, dpr, imgFit);
  const errClient = Math.hypot(rtClient.x - sample.x, rtClient.y - sample.y);

  // H2: imageToScreen returns LOCAL coords (i.e., already minus rect).
  const localCandidate = { x: client.x - rect.left, y: client.y - rect.top };
  const rtLocal = screenToImage(localCandidate.x + rect.left, localCandidate.y + rect.top, viewportEl, camera, dpr, imgFit);
  const errLocal = Math.hypot(rtLocal.x - sample.x, rtLocal.y - sample.y);

  const mode: 'client' | 'local' = errClient <= errLocal ? 'client' : 'local';

  return {
    toLocalFromImage(ix: number, iy: number) {
      const c = imageToScreen(ix, iy, viewportEl, camera, dpr, imgFit);
      if (mode === 'client') {
        return { x: c.x - rect.left, y: c.y - rect.top };
      }
      // Already local
      return c as { x:number; y:number };
    },
  };
}
