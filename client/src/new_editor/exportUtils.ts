// Export Utilities for Canvas and Assets
import { useEditorStore } from './store';

export interface ExportOptions {
  format: 'png' | 'jpeg';
  quality?: number; // 0-1 for JPEG
  includeAssets: boolean;
  includeMaterials: boolean;
  maxTimeoutMs: number;
}

export interface ExportResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  stats: {
    width: number;
    height: number;
    duration: number;
    format: string;
    sizeBytes?: number;
  };
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  options: ExportOptions = {
    format: 'png',
    quality: 0.9,
    includeAssets: true,
    includeMaterials: true,
    maxTimeoutMs: 10000
  }
): Promise<ExportResult> {
  const startTime = Date.now();
  
  try {
    const { width, height } = canvas;
    
    // Create export canvas with same dimensions
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d');
    
    if (!exportCtx) {
      throw new Error('Failed to get export canvas context');
    }
    
    // Copy base canvas content
    exportCtx.drawImage(canvas, 0, 0);
    
    // Add assets if enabled - TODO: Update to use Konva-based rendering
    if (options.includeAssets) {
      // Assets are now rendered by Konva system, not Canvas API
      // Export will include assets automatically through the main canvas
      console.log('[Export] Assets included via Konva rendering system');
    }
    
    // PHASE 5: Export - Add masks to export pipeline
    if (options.includeMaterials) {
      const { masks, photoSpace } = useEditorStore.getState();
      const dpr = window.devicePixelRatio || 1;
      
      if (masks && masks.length > 0) {
        exportCtx.save();
        
        // Apply same transforms as main canvas: DPR → pan → scale
        exportCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        exportCtx.translate(photoSpace.panX, photoSpace.panY);
        exportCtx.scale(photoSpace.scale, photoSpace.scale);
        
        // Render masks
        for (const mask of masks) {
          if (mask.points.length < 3) continue;
          
          exportCtx.save();
          exportCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          exportCtx.strokeStyle = '#00ff00';
          exportCtx.lineWidth = 2;
          
          exportCtx.beginPath();
          const firstPoint = mask.points[0];
          if (firstPoint) {
            exportCtx.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < mask.points.length; i++) {
              const point = mask.points[i];
              if (point) {
                exportCtx.lineTo(point.x, point.y);
              }
            }
          }
          exportCtx.closePath();
          
          exportCtx.fill();
          exportCtx.stroke();
          exportCtx.restore();
        }
        
        exportCtx.restore();
      }
    }
    
    // Convert to requested format
    let dataUrl: string;
    let mimeType: string;
    
    if (options.format === 'jpeg') {
      mimeType = 'image/jpeg';
      dataUrl = exportCanvas.toDataURL(mimeType, options.quality);
    } else {
      mimeType = 'image/png';
      dataUrl = exportCanvas.toDataURL(mimeType);
    }
    
    const duration = Date.now() - startTime;
    const sizeBytes = Math.round((dataUrl.length - 22) * 3 / 4); // Approximate size
    
    return {
      success: true,
      dataUrl,
      stats: {
        width,
        height,
        duration,
        format: options.format.toUpperCase(),
        sizeBytes
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown export error',
      stats: {
        width: canvas.width,
        height: canvas.height,
        duration,
        format: options.format.toUpperCase()
      }
    };
  }
}

export function downloadExport(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function showExportToast(result: ExportResult): void {
  if (result.success) {
    const { width, height, duration, format, sizeBytes } = result.stats;
    const sizeText = sizeBytes ? ` (${Math.round(sizeBytes / 1024)}KB)` : '';
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
    toast.innerHTML = `
      <div class="font-medium">Export Complete</div>
      <div class="text-sm">${width}×${height} ${format}${sizeText} in ${duration}ms</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  } else {
    // Error toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
    toast.innerHTML = `
      <div class="font-medium">Export Failed</div>
      <div class="text-sm">${result.error}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 5000);
  }
}
