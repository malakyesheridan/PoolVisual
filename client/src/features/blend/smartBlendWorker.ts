// @ts-nocheck
// NOTE: Keep this pure TS/JS; no React imports. Use OffscreenCanvas when available.

type MsgIn = {
  id: string;
  background: ImageBitmap | ImageDataLike | { dataURL: string };
  material: { albedoURL: string; scale: number; physicalRepeatM?: number }; // Added physicalRepeatM
  polygon: Array<{ x: number; y: number }>;
  canvasSize: { w: number; h: number };
  strength: number; // 0..1
};

type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number };

function toCanvasAndCtx(w: number, h: number) {
  const off = (typeof OffscreenCanvas !== "undefined")
    ? new OffscreenCanvas(w, h)
    : (() => { const c = self.document?.createElement?.("canvas"); c.width=w; c.height=h; return c; })();
  const ctx = (off as any).getContext("2d", { willReadFrequently: true })!;
  return { off, ctx };
}

function loadImageBitmapFrom(anyImg: ImageBitmap | ImageDataLike | { dataURL: string }) : Promise<ImageBitmap> {
  if ((anyImg as any).close || (anyImg as any).width && (anyImg as any).height && (anyImg as any).colorSpace !== undefined) {
    return Promise.resolve(anyImg as ImageBitmap);
  }
  if ((anyImg as ImageDataLike).data) {
    const { width, height, data } = anyImg as ImageDataLike;
    const { off, ctx } = toCanvasAndCtx(width, height);
    const id = new ImageData(new Uint8ClampedArray((data as any)), width, height);
    ctx.putImageData(id, 0, 0);
    return (off as any).convertToBlob ? (off as any).convertToBlob().then((b:Blob)=>createImageBitmap(b)) : createImageBitmap(id);
  }
  if ((anyImg as any).dataURL) {
    return fetch((anyImg as any).dataURL).then(r=>r.blob()).then(createImageBitmap);
  }
  return Promise.reject("Unsupported background format");
}

async function loadImageBitmapFromURL(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { mode: "cors" }).catch(()=>null);
  if (!res || !res.ok) throw new Error("Failed to load material albedo");
  const blob = await res.blob();
  return await createImageBitmap(blob);
}

function polygonPath(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, poly: {x:number;y:number}[]) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

function rgb2lab(r:number,g:number,b:number){
  // sRGB->XYZ->LAB (D65)
  const srgb = [r/255,g/255,b/255].map(v => v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  const [R,G,B]=srgb;
  const X = R*0.4124 + G*0.3576 + B*0.1805;
  const Y = R*0.2126 + G*0.7152 + B*0.0722;
  const Z = R*0.0193 + G*0.1192 + B*0.9505;
  const xn=0.95047, yn=1.00000, zn=1.08883;
  function f(t:number){ return t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
  const fx=f(X/xn), fy=f(Y/yn), fz=f(Z/zn);
  const L = (116*fy - 16);
  const a = 500*(fx - fy);
  const b2 = 200*(fy - fz);
  return [L,a,b2];
}

function lab2rgb(L:number,a:number,b:number){
  const fy=(L+16)/116, fx=a/500+fy, fz=fy-b/200;
  const xn=0.95047, yn=1.0, zn=1.08883;
  function fInv(t:number){ const t3=t*t*t; return t3>0.008856 ? t3 : (t-16/116)/7.787; }
  const X=xn*fInv(fx), Y=yn*fInv(fy), Z=zn*fInv(fz);
  let r =  3.2406*X + -1.5372*Y + -0.4986*Z;
  let g = -0.9689*X +  1.8758*Y +  0.0415*Z;
  let b3=  0.0557*X + -0.2040*Y +  1.0570*Z;
  function clamp01(x:number){ return Math.min(1,Math.max(0,x)); }
  // gamma
  function gamma(u:number){ return u<=0.0031308 ? 12.92*u : 1.055*Math.pow(u,1/2.4)-0.055; }
  r = gamma(clamp01(r)); g = gamma(clamp01(g)); b3 = gamma(clamp01(b3));
  return [Math.round(r*255),Math.round(g*255),Math.round(b3*255)];
}

function gaussianBlur(ctx:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D, w:number,h:number, radius:number) {
  // box blur approx: 3 passes
  ctx.filter = `blur(${radius}px)`;
  const img = ctx.getImageData(0,0,w,h);
  const { off, ctx:ctx2 } = toCanvasAndCtx(w,h);
  ctx2.putImageData(img,0,0);
  (ctx as any).drawImage(off as any,0,0);
  ctx.filter = "none";
}

function sobelMag(src: ImageBitmap): ImageData {
  const w=src.width,h=src.height;
  const { off, ctx } = toCanvasAndCtx(w,h);
  (ctx as any).drawImage(src,0,0);
  const id = ctx.getImageData(0,0,w,h);
  const out = ctx.createImageData(w,h);
  const d=id.data, o=out.data;
  function lum(i:number){ const r=d[i],g=d[i+1],b=d[i+2]; return 0.2126*r+0.7152*g+0.0722*b; }
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i=(y*w+x)*4;
      const xm1=i-4, xp1=i+4, ym1=i-4*w, yp1=i+4*w;
      const gx = -lum(ym1+xm1)-2*lum(i-4)-lum(yp1+xm1)+lum(ym1+xp1)+2*lum(i+4)+lum(yp1+xp1);
      const gy = -lum(ym1+xm1)-2*lum(ym1)+-lum(ym1+xp1)+lum(yp1+xm1)+2*lum(yp1)+lum(yp1+xp1);
      const g = Math.min(255, Math.hypot(gx,gy));
      o[i]=o[i+1]=o[i+2]=g; o[i+3]=255;
    }
  }
  return out;
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as MsgIn;
  try {
    const bg = await loadImageBitmapFrom(msg.background);
    const mat = await loadImageBitmapFromURL(msg.material.albedoURL);

    const W = msg.canvasSize.w, H = msg.canvasSize.h;
    const { off, ctx } = toCanvasAndCtx(W,H);

    // 1) Extract region under polygon from background for stats
    ctx.clearRect(0,0,W,H);
    polygonPath(ctx, msg.polygon);
    ctx.save();
    ctx.clip();
    (ctx as any).drawImage(bg,0,0,W,H);
    const region = ctx.getImageData(0,0,W,H);
    ctx.restore();

    // Compute LAB mean/std in-mask
    let sumL=0,suma=0,sumb=0,n=0;
    const rd = region.data;
    for(let i=0;i<rd.length;i+=4){
      const a = rd[i+3];
      if(a<5) continue;
      const [L,aa,bb] = rgb2lab(rd[i],rd[i+1],rd[i+2]);
      sumL+=L; suma+=aa; sumb+=bb; n++;
    }
    const meanL=sumL/(n||1), meana=suma/(n||1), meanb=sumb/(n||1);

    // Get std
    let sL=0, sa=0, sb=0;
    for(let i=0;i<rd.length;i+=4){
      if(rd[i+3]<5) continue;
      const [L,aa,bb] = rgb2lab(rd[i],rd[i+1],rd[i+2]);
      sL+=(L-meanL)**2; sa+=(aa-meana)**2; sb+=(bb-meanb)**2;
    }
    const stdL=Math.sqrt(sL/(n||1)+1e-6), stda=Math.sqrt(sa/(n||1)+1e-6), stdb=Math.sqrt(sb/(n||1)+1e-6);

    // 2) Build shading map from smoothed L channel
    const { off: shadeC, ctx: shadeCtx } = toCanvasAndCtx(W,H);
    (shadeCtx as any).drawImage(bg,0,0,W,H);
    let id = shadeCtx.getImageData(0,0,W,H);
    // compute luminance into alpha for convenience
    const lum = new Uint8ClampedArray(id.width*id.height);
    for(let i=0,j=0;i<id.data.length;i+=4,j++){
      lum[j] = 0.2126*id.data[i]+0.7152*id.data[i+1]+0.0722*id.data[i+2];
    }
    const id2 = new ImageData(lum, W, H);
    shadeCtx.putImageData(id2,0,0);
    gaussianBlur(shadeCtx,W,H,10);
    const blurred = shadeCtx.getImageData(0,0,W,H).data;
    // normalize shading to ~0.7..1.3 range
    let sum=0; for(let i=0;i<blurred.length;i+=4) sum+=blurred[i];
    const avg = sum/((blurred.length/4)||1);
    const sh = new Float32Array(W*H);
    for(let i=0,j=0;i<blurred.length;i+=4,j++){
      const f = blurred[i]/(avg||1);
      // compress contrast
      sh[j] = Math.min(1.3, Math.max(0.7, Math.pow(f, 0.85)));
    }

    // 3) AO from edges within mask
    const edgesId = sobelMag(bg);
    const ed = edgesId.data;
    const ao = new Float32Array(W*H);
    for(let i=0,j=0;i<ed.length;i+=4,j++){
      ao[j] = (ed[i]/255)*0.15; // max 15% darkening
    }

    // 4) Warp+tile material into polygon with proper scale calculation
    const { off: matC, ctx: matCtx } = toCanvasAndCtx(W,H);
    
    // Calculate proper tile size based on material properties
    // Default to 0.3m if physicalRepeatM not provided
    const physicalRepeatM = msg.material.physicalRepeatM || 0.3;
    // Assume 100 pixels per meter for scale calculation (will be refined by calibration)
    const pixelsPerMeter = 100;
    const tileSizePixels = Math.max(32, Math.floor(physicalRepeatM * pixelsPerMeter * (msg.material.scale || 1)));
    
    // Create pattern canvas for tiling with proper size
    const { off: tileC, ctx: tileCtx } = toCanvasAndCtx(tileSizePixels, tileSizePixels);
    (tileCtx as any).drawImage(mat,0,0,tileSizePixels,tileSizePixels);
    const pattern = (matCtx as any).createPattern(tileC as any, "repeat");
    
    if (!pattern) {
      throw new Error("Failed to create material pattern");
    }
    
    matCtx.save();
    polygonPath(matCtx,msg.polygon);
    matCtx.clip();
    matCtx.fillStyle = pattern as any;
    matCtx.fillRect(0,0,W,H);
    matCtx.restore();
    const matId = matCtx.getImageData(0,0,W,H);

    // 5) Color transfer (LAB mean/std match)
    const md = matId.data;
    for(let i=0;i<md.length;i+=4){
      const a = rd[i+3];
      if(a<5) { md[i+3]=0; continue;}
      const [L,a1,b1] = rgb2lab(md[i],md[i+1],md[i+2]);
      // match mean/std with conservative strength
      const k = Math.max(0.3, Math.min(1.0, msg.strength)); // 0.3..1.0
      const L2 = ( (L - 50) * (k* (stdL/20)) ) + meanL;
      const a2 = ( (a1 - 0) * (k* (stda/10)) ) + meana;
      const b2 = ( (b1 - 0) * (k* (stdb/10)) ) + meanb;
      const [r,g,b] = lab2rgb(L2,a2,b2);
      md[i]=r; md[i+1]=g; md[i+2]=b; md[i+3]=255;
    }

    // 6) Apply shading + AO
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const j = (y*W+x);
        const i = j*4;
        if (rd[i+3]<5) { md[i+3]=0; continue; }
        const shade = sh[j];
        md[i]   = Math.min(255, md[i]  * shade);
        md[i+1] = Math.min(255, md[i+1]* shade);
        md[i+2] = Math.min(255, md[i+2]* shade);
        const dark = 1.0 - ao[j];
        md[i]   = md[i]*dark;
        md[i+1] = md[i+1]*dark;
        md[i+2] = md[i+2]*dark;
      }
    }

    // 7) Feather mask edges
    ctx.clearRect(0,0,W,H);
    polygonPath(ctx,msg.polygon);
    ctx.clip();
    // draw result to ctx
    const outId = new ImageData(md, W, H);
    ctx.putImageData(outId,0,0);
    // soft feather: draw mask as blur alpha on top to smooth edges
    ctx.globalCompositeOperation = "destination-in";
    const { off: mC, ctx: mCtx } = toCanvasAndCtx(W,H);
    mCtx.clearRect(0,0,W,H);
    polygonPath(mCtx,msg.polygon);
    mCtx.fillStyle = "#fff"; mCtx.fill();
    // blur
    gaussianBlur(mCtx,W,H,2.0);
    (ctx as any).drawImage(mC as any,0,0);
    ctx.globalCompositeOperation = "source-over";

    // Compose onto background (non-destructive: return composite only)
    const { off: finalC, ctx: fctx } = toCanvasAndCtx(W,H);
    (fctx as any).drawImage(bg,0,0,W,H);
    (fctx as any).drawImage(off as any,0,0);

    // Return PNG dataURL
    let dataURL: string;
    if ((finalC as any).convertToBlob) {
      const blob = await (finalC as any).convertToBlob({ type: "image/png" });
      dataURL = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
    } else {
      dataURL = (finalC as HTMLCanvasElement).toDataURL("image/png");
    }
    (self as any).postMessage({ id: msg.id, ok: true, dataURL }, undefined as any);
  } catch (e:any) {
    (self as any).postMessage({ id: msg.id, ok: false, error: e?.message || String(e) }, undefined as any);
  }
};
