import { loadHtmlImage } from './loadHtmlImage';

export function fitAndCenterImage(htmlImg: HTMLImageElement, stage: any, layer: any) {
  const iw = htmlImg.naturalWidth, ih = htmlImg.naturalHeight;
  const sw = stage.width(), sh = stage.height();
  const scale = Math.min(sw / iw, sh / ih); // uniform scale preserves aspect ratio
  const x = (sw - iw * scale) / 2;
  const y = (sh - ih * scale) / 2;

  // Remove previous base image (keep one base)
  layer.destroyChildren();

  // Create a new Konva Image node using the constructor
  const Konva = (window as any).Konva;
  if (Konva && Konva.Image) {
    const node = new Konva.Image({
      image: htmlImg,
      width: iw,
      height: ih,
      x, y,
      scaleX: scale,
      scaleY: scale,
      listening: false
    });

    layer.add(node);
    layer.batchDraw();
  }
}

export async function addPhotoToStage(publicUrl: string, stage: any, backgroundLayer: any) {
  const img = await loadHtmlImage(publicUrl);
  fitAndCenterImage(img, stage, backgroundLayer);
}

export function setZoom(stage: any, newScale: number, centerX?: number, centerY?: number) {
  const oldScale = stage.scaleX();
  const pointer = { x: centerX ?? stage.width() / 2, y: centerY ?? stage.height() / 2 };
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  
  // Clamp scale between 0.25 and 4
  const clampedScale = Math.max(0.25, Math.min(4, newScale));
  
  stage.scale({ x: clampedScale, y: clampedScale }); // uniform scaling
  const newPos = {
    x: pointer.x - mousePointTo.x * clampedScale,
    y: pointer.y - mousePointTo.y * clampedScale,
  };
  stage.position(newPos);
  stage.batchDraw();
}