// client/src/workers/imageProcessor.worker.ts
// Heavy operations moved to Web Worker

interface ProcessImageMessage {
  id: string;
  type: 'process' | 'renderMasks' | 'cancel';
  imageData?: ImageData;
  operations?: any[];
  masks?: any[];
  materials?: any[];
  canvasSize?: { width: number; height: number };
  timeout?: number;
}

self.onmessage = async (e: MessageEvent<ProcessImageMessage>) => {
  const { id, type, timeout = 30000 } = e.data;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Support cancel messages
  const cancelHandler = (event: MessageEvent<ProcessImageMessage>) => {
    if (event.data.type === 'cancel' && event.data.id === id) {
      controller.abort();
      clearTimeout(timeoutId);
      self.removeEventListener('message', cancelHandler);
    }
  };
  
  self.addEventListener('message', cancelHandler);
  
  try {
    if (type === 'process' && e.data.imageData && e.data.operations) {
      // Process image with operations
      const result = await processImage(e.data.imageData, e.data.operations, {
        signal: controller.signal,
        transferable: true, // Use transferable buffers
      });
      
      // Transfer result back
      if (result.buffer instanceof ArrayBuffer) {
        self.postMessage(
          { id, success: true, result: result.buffer },
          [result.buffer] // Transfer ownership
        );
      } else {
        self.postMessage({ id, success: true, result });
      }
    } else if (type === 'renderMasks' && e.data.masks && e.data.materials && e.data.canvasSize) {
      // Render masks
      const result = await renderMasks(
        e.data.masks,
        e.data.materials,
        e.data.canvasSize,
        { signal: controller.signal }
      );
      
      if (result.buffer instanceof ArrayBuffer) {
        self.postMessage(
          { id, success: true, result: result.buffer },
          [result.buffer] // Transfer ownership
        );
      } else {
        self.postMessage({ id, success: true, result });
      }
    }
    
    clearTimeout(timeoutId);
    self.removeEventListener('message', cancelHandler);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      self.postMessage({ id, success: false, error: 'Processing cancelled' });
    } else {
      self.postMessage({ id, success: false, error: error.message });
    }
    
    clearTimeout(timeoutId);
    self.removeEventListener('message', cancelHandler);
  }
};

// Placeholder implementations - these would be actual image processing functions
async function processImage(
  imageData: ImageData,
  operations: any[],
  options: { signal?: AbortSignal; transferable?: boolean }
): Promise<ImageData> {
  // Check for abort
  if (options.signal?.aborted) {
    throw new Error('Aborted');
  }
  
  // Process image (placeholder)
  return imageData;
}

async function renderMasks(
  masks: any[],
  materials: any[],
  canvasSize: { width: number; height: number },
  options: { signal?: AbortSignal }
): Promise<ImageData> {
  // Check for abort
  if (options.signal?.aborted) {
    throw new Error('Aborted');
  }
  
  // Create canvas and render masks (placeholder)
  const canvas = new OffscreenCanvas(canvasSize.width, canvasSize.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get context');
  
  // Render masks with materials
  for (const mask of masks) {
    // Render logic here
  }
  
  return ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
}

