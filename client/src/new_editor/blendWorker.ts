// Web Worker for auto-blending operations
// This runs in a separate thread to keep the UI responsive

interface BlendMessage {
  type: 'blend';
  imageData: ImageData;
  maskPoints: { x: number; y: number }[];
  materialUrl: string;
  materialScale: number;
}

interface BlendResult {
  type: 'blendResult';
  success: boolean;
  resultDataUrl?: string;
  error?: string;
}

self.onmessage = async (event: MessageEvent<BlendMessage>) => {
  if (event.data.type === 'blend') {
    try {
      const result = await performBlend(event.data);
      self.postMessage(result);
    } catch (error) {
      self.postMessage({
        type: 'blendResult',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

async function performBlend(data: BlendMessage): Promise<BlendResult> {
  const { imageData, maskPoints, materialUrl, materialScale } = data;
  
  // Create canvas for processing
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d')!;
  
  // Draw original image
  ctx.putImageData(imageData, 0, 0);
  
  // Load material texture
  const materialImg = await loadImage(materialUrl);
  
  // Create pattern from material
  const pattern = ctx.createPattern(materialImg, 'repeat')!;
  
  // Create mask path
  ctx.beginPath();
  if (maskPoints.length > 0) {
    ctx.moveTo(maskPoints[0].x, maskPoints[0].y);
    for (let i = 1; i < maskPoints.length; i++) {
      ctx.lineTo(maskPoints[i].x, maskPoints[i].y);
    }
    ctx.closePath();
  }
  
  // Apply material with scaling
  ctx.save();
  ctx.scale(materialScale, materialScale);
  ctx.fillStyle = pattern;
  ctx.fill();
  ctx.restore();
  
  // Simple color matching - sample background color around mask edges
  const edgeColor = sampleEdgeColor(ctx, maskPoints, imageData);
  
  // Apply color adjustment to the material
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, 0.3)`;
  ctx.fill();
  
  // Feather edges
  ctx.globalCompositeOperation = 'destination-over';
  ctx.filter = 'blur(2px)';
  ctx.fill();
  
  // Convert to data URL
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl = await blobToDataUrl(blob);
  
  return {
    type: 'blendResult',
    success: true,
    resultDataUrl: dataUrl
  };
}

function loadImage(url: string): Promise<ImageBitmap> {
  return fetch(url)
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob));
}

function sampleEdgeColor(
  ctx: OffscreenCanvasRenderingContext2D,
  maskPoints: { x: number; y: number }[],
  originalImageData: ImageData
): { r: number; g: number; b: number } {
  // Sample color from original image around mask edges
  const samples: { r: number; g: number; b: number }[] = [];
  
  for (const point of maskPoints) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    
    if (x >= 0 && x < originalImageData.width && y >= 0 && y < originalImageData.height) {
      const index = (y * originalImageData.width + x) * 4;
      samples.push({
        r: originalImageData.data[index],
        g: originalImageData.data[index + 1],
        b: originalImageData.data[index + 2]
      });
    }
  }
  
  // Calculate average color
  if (samples.length === 0) {
    return { r: 128, g: 128, b: 128 }; // Default gray
  }
  
  const avg = samples.reduce(
    (acc, sample) => ({
      r: acc.r + sample.r,
      g: acc.g + sample.g,
      b: acc.b + sample.b
    }),
    { r: 0, g: 0, b: 0 }
  );
  
  return {
    r: Math.round(avg.r / samples.length),
    g: Math.round(avg.g / samples.length),
    b: Math.round(avg.b / samples.length)
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
