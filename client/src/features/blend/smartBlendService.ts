import { runSmartBlend, cleanupWorker, cancelSmartBlend } from './smartBlend';

export interface SmartBlendContext {
  stageToDataURL: (pixelRatio?: number) => string;
  getCurrentPolygon: () => Array<{x: number; y: number}> | null;
  canvasSize: () => { w: number; h: number };
  materialAlbedoURL: string;
  materialProperties?: {
    physicalRepeatM?: number;
    scale?: number;
  };
}

let currentWorkerId: string | null = null;
let isProcessing = false;

// Validate texture URL and ensure it's accessible
async function validateTextureURL(url: string): Promise<boolean> {
  if (!url || url.trim() === '') {
    throw new Error("Material texture URL is missing");
  }
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      throw new Error(`Texture URL returned ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }
    
    return true;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('CORS')) {
      throw new Error("Texture URL blocked by CORS policy");
    }
    throw new Error(`Failed to load texture: ${error.message}`);
  }
}

export async function applySmartBlendAuto(context: SmartBlendContext): Promise<string> {
  const { stageToDataURL, getCurrentPolygon, canvasSize, materialAlbedoURL, materialProperties } = context;

  // Cancel any previous operation
  if (isProcessing) {
    cancelSmartBlend();
    // Wait a bit for cancellation to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Generate unique worker ID for this operation
  const workerId = Math.random().toString(36).substring(2, 15);
  currentWorkerId = workerId;
  isProcessing = true;

  try {
    console.log('[SmartBlend] Starting validation...');
    
    // Validate polygon
    const polygon = getCurrentPolygon();
    if (!polygon || polygon.length < 3) {
      throw new Error("Draw a mask with at least 3 points first.");
    }
    console.log('[SmartBlend] Polygon validated:', polygon.length, 'points');

    // Validate canvas size
    const size = canvasSize();
    if (!size.w || !size.h) {
      throw new Error("Canvas size invalid.");
    }
    console.log('[SmartBlend] Canvas size validated:', size.w, 'x', size.h);

    // Validate background data
    const backgroundDataURL = stageToDataURL(2);
    if (!backgroundDataURL || backgroundDataURL === 'data:,') {
      throw new Error("Canvas not ready.");
    }
    console.log('[SmartBlend] Background data validated');

    // Validate texture URL
    await validateTextureURL(materialAlbedoURL);
    console.log('[SmartBlend] Texture URL validated:', materialAlbedoURL);

    // Check if this operation was cancelled
    if (currentWorkerId !== workerId) {
      throw new Error("Operation cancelled");
    }

    console.log('[SmartBlend] Starting worker...');
    const startTime = performance.now();
    
    const result = await runSmartBlend({
      backgroundDataURL,
      materialAlbedoURL,
      materialProperties: {
        physicalRepeatM: materialProperties?.physicalRepeatM || 0.3,
        scale: materialProperties?.scale || 1.0
      },
      polygon,
      canvasSize: size,
      scale: 1.0,
      strength: 0.7
    });

    const duration = performance.now() - startTime;
    console.log('[SmartBlend] Completed in', duration.toFixed(0), 'ms');
    
    // Check if this operation was cancelled
    if (currentWorkerId !== workerId) {
      throw new Error("Operation cancelled");
    }

    return result;
  } catch (error: any) {
    console.error('[SmartBlend] Failed:', error);
    
    // Clean up worker on error
    if (currentWorkerId === workerId) {
      cancelSmartBlend();
      currentWorkerId = null;
    }
    
    throw error;
  } finally {
    if (currentWorkerId === workerId) {
      isProcessing = false;
    }
  }
}

export function cancelSmartBlend(): void {
  console.log('[SmartBlend] Cancelling current operation...');
  if (currentWorkerId) {
    cancelSmartBlend();
    currentWorkerId = null;
  }
  isProcessing = false;
}

export function isSmartBlendProcessing(): boolean {
  return isProcessing;
}
