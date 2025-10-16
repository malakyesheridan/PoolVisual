/**
 * Export utilities for canvas PNG export
 */

/**
 * Export canvas as PNG with device pixel ratio awareness
 */
export async function exportCanvasAsPNG(
  stage: any, // Konva Stage
  options: {
    width?: number;
    height?: number;
    pixelRatio?: number;
    transparent?: boolean;
    selectionOnly?: boolean;
  } = {}
): Promise<Blob> {
  const {
    width,
    height,
    pixelRatio = window.devicePixelRatio || 1,
    transparent = true,
    selectionOnly = false
  } = options;

  // If no dimensions specified, use stage dimensions
  const exportWidth = width || stage.width();
  const exportHeight = height || stage.height();

  // Create a temporary canvas for export
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = exportWidth * pixelRatio;
  canvas.height = exportHeight * pixelRatio;
  canvas.style.width = `${exportWidth}px`;
  canvas.style.height = `${exportHeight}px`;
  
  // Set canvas context properties
  ctx.scale(pixelRatio, pixelRatio);
  
  if (transparent) {
    ctx.clearRect(0, 0, exportWidth, exportHeight);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportWidth, exportHeight);
  }

  // Export the stage to canvas
  const dataURL = stage.toDataURL({
    pixelRatio,
    mimeType: 'image/png',
    quality: 1,
    width: exportWidth,
    height: exportHeight,
    x: selectionOnly ? stage.x() : 0,
    y: selectionOnly ? stage.y() : 0,
  });

  // Convert data URL to blob
  const response = await fetch(dataURL);
  return response.blob();
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename with timestamp
 */
export function generateExportFilename(prefix: string = 'canvas'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.png`;
}
