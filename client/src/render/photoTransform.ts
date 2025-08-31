/**
 * PhotoSpace Transform System
 * 
 * Single canonical transform used by ALL layers (image, Konva masks, WebGL renderer).
 * Stores mask points in image-relative coordinates (original image pixel space).
 */

export type PhotoSpace = {
  imgW: number;      // natural image width
  imgH: number;      // natural image height  
  fitScale: number;  // base fit-to-container scale
  zoom: number;      // user zoom multiplier (starts at 1)
  panX: number;      // user pan in screen pixels after fit
  panY: number;      // user pan in screen pixels after fit
};

export type PhotoTransform = {
  S: number;         // scale = fitScale * zoom
  originX: number;   // screen-space top-left of image
  originY: number;   // screen-space top-left of image
};

export function makeTransform(p: {
  imgW: number;
  imgH: number;
  fitScale: number;
  zoom: number;
  panX: number;
  panY: number;
  containerW: number;
  containerH: number;
}): PhotoTransform {
  const S = p.fitScale * p.zoom;
  const originX = p.panX + (p.containerW - p.imgW * S) / 2;
  const originY = p.panY + (p.containerH - p.imgH * S) / 2;
  return { S, originX, originY };
}

// Image -> Screen coordinate conversion
export function imgToScreen(T: PhotoTransform, xImg: number, yImg: number): { x: number; y: number } {
  return { 
    x: T.originX + xImg * T.S, 
    y: T.originY + yImg * T.S 
  };
}

// Screen -> Image coordinate conversion (for pointer/input)
export function screenToImg(T: PhotoTransform, xScr: number, yScr: number): { x: number; y: number } {
  return { 
    x: (xScr - T.originX) / T.S, 
    y: (yScr - T.originY) / T.S 
  };
}

// Calculate fit scale for image to fit in container
export function calculateFitScale(
  imgW: number, 
  imgH: number, 
  containerW: number, 
  containerH: number
): number {
  const imageAspect = imgW / imgH;
  const containerAspect = containerW / containerH;
  
  // Use contain strategy - image fits entirely within container
  if (imageAspect > containerAspect) {
    return containerW / imgW;
  } else {
    return containerH / imgH;
  }
}

// Clamp zoom to reasonable bounds
export function clampZoom(zoom: number, min = 0.2, max = 6): number {
  return Math.max(min, Math.min(max, zoom));
}

// Zoom around cursor helper - adjusts pan to keep image point under cursor
export function zoomAroundCursor(
  currentSpace: PhotoSpace,
  containerW: number,
  containerH: number,
  cursorX: number,
  cursorY: number,
  zoomDelta: number
): PhotoSpace {
  // Before zoom
  const T0 = makeTransform({ ...currentSpace, containerW, containerH });
  const imgPoint = screenToImg(T0, cursorX, cursorY);
  
  // Apply new zoom
  const newZoom = clampZoom(currentSpace.zoom * zoomDelta);
  
  // Calculate transform with new zoom
  const T1 = makeTransform({ 
    ...currentSpace, 
    zoom: newZoom, 
    containerW, 
    containerH 
  });
  
  // Find where the image point would be on screen with new zoom
  const newScreenPoint = imgToScreen(T1, imgPoint.x, imgPoint.y);
  
  // Adjust pan to keep image point under cursor
  const panAdjustX = cursorX - newScreenPoint.x;
  const panAdjustY = cursorY - newScreenPoint.y;
  
  return {
    ...currentSpace,
    zoom: newZoom,
    panX: currentSpace.panX + panAdjustX,
    panY: currentSpace.panY + panAdjustY
  };
}