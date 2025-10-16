export async function exportComposite(opts: {
  threeCanvas: HTMLCanvasElement;
  backgroundImg?: HTMLImageElement;
  mask?: { type: "none"|"rect"|"polygon"; rect?: {x:number;y:number;w:number;h:number}; polygon?: Array<{x:number;y:number}> };
  scale?: number; // 1..4
}): Promise<Blob> {
  const { threeCanvas, backgroundImg, mask, scale = 2 } = opts;
  const w = backgroundImg?.width || threeCanvas.width;
  const h = backgroundImg?.height || threeCanvas.height;
  const out = document.createElement("canvas");
  out.width = Math.floor(w * scale);
  out.height = Math.floor(h * scale);
  const ctx = out.getContext("2d")!;
  
  // Enable high-quality image smoothing for better results
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // draw background
  if (backgroundImg) ctx.drawImage(backgroundImg, 0, 0, out.width, out.height);
  
  // create mask if any
  if (mask && mask.type !== "none") {
    ctx.save();
    ctx.beginPath();
    if (mask.type === "rect" && mask.rect) {
      const r = mask.rect;
      ctx.rect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
    } else if (mask.type === "polygon" && mask.polygon?.length) {
      const p = mask.polygon;
      ctx.moveTo(p[0].x * scale, p[0].y * scale);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x * scale, p[i].y * scale);
      ctx.closePath();
    }
    ctx.clip();
    // draw 3D canvas
    ctx.drawImage(threeCanvas, 0, 0, out.width, out.height);
    ctx.restore();
  } else {
    ctx.drawImage(threeCanvas, 0, 0, out.width, out.height);
  }
  
  return await new Promise((res) => out.toBlob(b => res(b!), "image/png"));
}
