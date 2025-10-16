export async function averageImageRGB(src: string): Promise<[number, number, number]> {
  const img = new Image(); 
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => { 
    img.onload = () => res(); 
    img.onerror = rej; 
    img.src = src; 
  });
  
  const c = document.createElement("canvas"); 
  c.width = 256; 
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0,0,c.width,c.height).data;
  
  let r=0,g=0,b=0, n = (data.length/4)|0;
  for (let i = 0; i < data.length; i += 4) { 
    r += data[i]; 
    g += data[i+1]; 
    b += data[i+2]; 
  }
  return [r/n, g/n, b/n];
}

export function computeTintFromAvg([r,g,b]: [number,number,number]): [number,number,number] {
  const avg = (r+g+b)/3 || 1;
  return [avg/(r||1), avg/(g||1), avg/(b||1)]; // brings RGB towards neutral gray
}

export function exposureFromLuma([r,g,b]: [number,number,number]): number {
  // simple mapping: brighter photo → lower exposure
  const luma = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  return Math.min(2.5, Math.max(0.3, 1.2 - (luma - 0.5))); // clamp to 0.3..2.5
}
