import { PhotoSpace, Point } from './types';
// B) MASK CURSOR OFFSET - Use unified coordinate mapping
import { screenToImage as unifiedScreenToImage, imageToScreen as unifiedImageToScreen } from './coord';

/**
 * Convert screen coordinates (CSS pixels) to image coordinates
 * 
 * @param screenPoint - Point in CSS pixels relative to canvas
 * @param photoSpace - Current PhotoSpace transform
 * @returns Point in image pixel coordinates
 */
export function screenToImage(screenPoint: Point, photoSpace: PhotoSpace, canvas?: HTMLCanvasElement): Point {
  // If canvas is provided, screenPoint is already canvas-relative coordinates
  // If no canvas, screenPoint is screen coordinates and we need to convert
  const targetCanvas = canvas || document.querySelector('canvas');
  if (!targetCanvas) {
    // Fallback to old method if canvas not available
    const { scale, panX, panY, imgW, imgH } = photoSpace;
    const imageX = (screenPoint.x - panX) / scale;
    const imageY = (screenPoint.y - panY) / scale;
    const clampedX = Math.max(0, Math.min(imageX, imgW || 1000));
    const clampedY = Math.max(0, Math.min(imageY, imgH || 1000));
    console.log('[screenToImage:DEBUG] Fallback method:', { screenPoint, photoSpace, result: { x: clampedX, y: clampedY } });
    return { x: clampedX, y: clampedY };
  }
  
  // Calculate image parameters for coordinate mapping
  const imgParams = { originX: 0, originY: 0, scale: 1 }; // Default values
  
  let result: Point;
  if (canvas) {
    // Canvas provided - screenPoint is already canvas-relative, use direct conversion
    const DPR = window.devicePixelRatio || 1;
    const sx = screenPoint.x * DPR;
    const sy = screenPoint.y * DPR;
    const ix = ((sx - photoSpace.panX) / photoSpace.scale - imgParams.originX) / imgParams.scale;
    const iy = ((sy - photoSpace.panY) / photoSpace.scale - imgParams.originY) / imgParams.scale;
    result = { x: ix, y: iy };
  } else {
    // No canvas provided - use unified method with screen coordinates
    result = unifiedScreenToImage(
      screenPoint.x,
      screenPoint.y,
      targetCanvas,
      { scale: photoSpace.scale, panX: photoSpace.panX, panY: photoSpace.panY },
      window.devicePixelRatio || 1,
      imgParams
    );
  }
  
  console.log('[screenToImage:DEBUG]', { 
    screenPoint, 
    photoSpace, 
    canvas: targetCanvas,
    canvasProvided: !!canvas,
    result 
  });
  
  return result;
}

/**
 * Convert image coordinates to screen coordinates (CSS pixels)
 * 
 * @param imagePoint - Point in image pixel coordinates
 * @param photoSpace - Current PhotoSpace transform
 * @returns Point in CSS pixels relative to canvas
 */
export function imageToScreen(imagePoint: Point, photoSpace: PhotoSpace): Point {
  const { scale, panX, panY } = photoSpace;
  
  return {
    x: imagePoint.x * scale + panX,
    y: imagePoint.y * scale + panY
  };
}

/**
 * Get mouse coordinates from mouse event, accounting for canvas position
 * 
 * @param e - Mouse event
 * @param canvas - Canvas element
 * @returns Point in CSS pixels relative to canvas
 */
export function getMouseCanvasCoords(e: React.MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

/**
 * Debug function to verify coordinate transformations
 * 
 * @param screenPoint - Original screen point
 * @param photoSpace - Current PhotoSpace
 * @returns Debug info with round-trip verification
 */
export function debugCoordinateTransform(screenPoint: Point, photoSpace: PhotoSpace) {
  const imagePoint = screenToImage(screenPoint, photoSpace);
  const backToScreen = imageToScreen(imagePoint, photoSpace);
  
  const deltaX = Math.abs(screenPoint.x - backToScreen.x);
  const deltaY = Math.abs(screenPoint.y - backToScreen.y);
  
  return {
    original: screenPoint,
    image: imagePoint,
    roundTrip: backToScreen,
    delta: { x: deltaX, y: deltaY },
    isValid: deltaX < 0.5 && deltaY < 0.5
  };
}

// Calculate fit scale to center image in container
export function calculateFitScale(
  imgW: number,
  imgH: number,
  containerW: number,
  containerH: number,
  padding = 0.98
): number {
  if (imgW <= 0 || imgH <= 0 || containerW <= 0 || containerH <= 0) {
    console.log('[calculateFitScale] Invalid dimensions:', { imgW, imgH, containerW, containerH });
    return 1;
  }
  
  // Calculate scale to fit image in container with padding
  const scaleX = (containerW * padding) / imgW;
  const scaleY = (containerH * padding) / imgH;
  
  // Use the smaller scale to ensure the image fits completely
  const finalScale = Math.min(scaleX, scaleY);
  
  console.log('[calculateFitScale] Calculated scale:', { 
    imgW, imgH, containerW, containerH, padding,
    scaleX, scaleY, finalScale 
  });
  
  return finalScale;
}

// Calculate center pan to position image in container
export function calculateCenterPan(
  imgW: number,
  imgH: number,
  containerW: number,
  containerH: number,
  scale: number
): { panX: number; panY: number } {
  const panX = (containerW - imgW * scale) / 2;
  const panY = (containerH - imgH * scale) / 2;
  
  console.log('[calculateCenterPan] Calculated pan:', { 
    imgW, imgH, containerW, containerH, scale,
    panX, panY 
  });
  
  return { panX, panY };
}

// Zoom centered at a specific point
export function zoomAtPoint(
  currentPhotoSpace: PhotoSpace,
  newScale: number,
  centerPoint: Point
): PhotoSpace {
  const { scale: oldScale, panX: oldPanX, panY: oldPanY } = currentPhotoSpace;
  
  // Calculate new pan to keep the center point in the same screen position
  const scaleRatio = newScale / oldScale;
  const newPanX = centerPoint.x - (centerPoint.x - oldPanX) * scaleRatio;
  const newPanY = centerPoint.y - (centerPoint.y - oldPanY) * scaleRatio;
  
  return {
    ...currentPhotoSpace,
    scale: newScale,
    panX: newPanX,
    panY: newPanY
  };
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Format zoom percentage
export function formatZoomLabel(scale: number): string {
  const percentage = Math.round(scale * 100);
  return `${percentage}%`;
}

// Check if point is inside polygon (for mask selection)
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Calculate distance between two points
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Find closest point in array to target point
export function findClosestPoint(target: Point, points: Point[]): Point | null {
  if (points.length === 0) return null;
  
  let closest = points[0];
  let minDistance = distance(target, closest);
  
  for (let i = 1; i < points.length; i++) {
    const dist = distance(target, points[i]);
    if (dist < minDistance) {
      minDistance = dist;
      closest = points[i];
    }
  }
  
  return closest;
}

/**
 * Get bounding box for a set of points
 * 
 * @param points - Array of points
 * @returns Bounding box with min/max coordinates
 */
export function getMaskBounds(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxX = Math.max(maxX, points[i].x);
    maxY = Math.max(maxY, points[i].y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Safely access mask point coordinates, handling both Point and MaskPoint formats
 */
export function getMaskPointCoords(point: any): { x: number; y: number } {
  return {
    x: point.x || 0,
    y: point.y || 0
  };
}

/**
 * Convert mask points to simple Point array for rendering
 */
export function maskPointsToPoints(maskPoints: any[]): Point[] {
  return maskPoints.map(point => ({
    x: point.x || 0,
    y: point.y || 0
  }));
}

/**
 * Offset polygon points inward by given distance
 * Used for creating bands around pool shapes
 */

/**
 * Simple RDP (Ramer-Douglas-Peucker) polygon simplification
 * PHASE 6: Edge cases - keeps performance sane for large point arrays
 */
export function simplifyPolygon(points: Point[], threshold: number): Point[] {
  if (points.length <= 2) return points;
  
  // Find the point with maximum distance from the line between first and last points
  let maxDist = 0;
  let maxIndex = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = pointToLineDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // If max distance is greater than threshold, recursively simplify
  if (maxDist > threshold) {
    const left = simplifyPolygon(points.slice(0, maxIndex + 1), threshold);
    const right = simplifyPolygon(points.slice(maxIndex), threshold);
    return [...left.slice(0, -1), ...right]; // Remove duplicate middle point
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Calculate distance from point to line segment
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);
  
  let param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
export function offsetPolygonInward(points: Array<{ x: number; y: number; kind?: string }>, distance: number): Array<{ x: number; y: number; kind: string }> {
  if (points.length < 3) return [];
  
  const offsetPoints: Array<{ x: number; y: number; kind: string }> = [];
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    
    // Calculate inward normal
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Average the edge directions
    const nx = (dx1 + dx2) / 2;
    const ny = (dy1 + dy2) / 2;
    
    // Calculate perpendicular (inward)
    const perpX = ny;
    const perpY = -nx;
    
    const len = Math.sqrt(perpX * perpX + perpY * perpY);
    if (len === 0) {
      offsetPoints.push({
        x: curr.x,
        y: curr.y,
        kind: curr.kind || 'corner'
      });
      continue;
    }
    
    // Apply inward offset
    offsetPoints.push({
      x: curr.x + (perpX / len) * distance,
      y: curr.y + (perpY / len) * distance,
      kind: curr.kind || 'corner'
    });
  }
  
  return offsetPoints;
}

/**
 * Calculate the area of a polygon using the shoelace formula
 * 
 * @param points - Array of points defining the polygon
 * @returns Area in square pixels
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Test function to verify polygon area calculation works correctly
 * This can be called from the browser console for testing
 */
export function testPolygonAreaCalculation(): void {
  console.log('[CALIBRATION TEST] Testing polygon area calculation...');
  
  // Test 1: Simple rectangle (4x3 = 12 square units)
  const rectangle = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 }
  ];
  const rectArea = calculatePolygonArea(rectangle);
  console.log('Rectangle (4x3):', rectArea, 'Expected: 12');
  
  // Test 2: Triangle (base=4, height=3, area=6)
  const triangle = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 2, y: 3 }
  ];
  const triArea = calculatePolygonArea(triangle);
  console.log('Triangle (4x3):', triArea, 'Expected: 6');
  
  // Test 3: Complex polygon (L-shape)
  const lShape = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 0, y: 4 }
  ];
  const lArea = calculatePolygonArea(lShape);
  console.log('L-shape:', lArea, 'Expected: 12');
  
  // Test 4: Invalid polygon (less than 3 points)
  const invalid = [
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ];
  const invalidArea = calculatePolygonArea(invalid);
  console.log('Invalid (<3 points):', invalidArea, 'Expected: 0');
  
  console.log('[CALIBRATION TEST] Polygon area calculation test completed');
}

/**
 * Convert polygon area from pixels to square meters using calibration
 * 
 * @param points - Array of points defining the polygon
 * @param pixelsPerMeter - Calibration factor (pixels per meter)
 * @returns Area in square meters
 */
export function calculatePolygonAreaInSquareMeters(
  points: Point[], 
  pixelsPerMeter: number
): number {
  if (pixelsPerMeter <= 0) {
    console.warn('[CALIBRATION] Invalid pixelsPerMeter:', pixelsPerMeter);
    return 0;
  }
  
  const areaPixels = calculatePolygonArea(points);
  const areaSquareMeters = areaPixels / (pixelsPerMeter * pixelsPerMeter);
  
  return areaSquareMeters;
}

/**
 * Test function to verify calibration system works correctly
 * This can be called from the browser console for testing
 */
export function testCalibrationSystem(): void {
  console.log('[CALIBRATION TEST] Testing calibration system...');
  
  // Test 1: Polygon area calculation
  const testPolygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 }
  ];
  const areaPixels = calculatePolygonArea(testPolygon);
  console.log('Test polygon area (pixels):', areaPixels, 'Expected: 5000');
  
  // Test 2: Area conversion with calibration
  const pixelsPerMeter = 100; // 100 pixels per meter
  const areaSquareMeters = calculatePolygonAreaInSquareMeters(testPolygon, pixelsPerMeter);
  console.log('Test polygon area (square meters):', areaSquareMeters, 'Expected: 0.5');
  
  // Test 3: Calibration calculation
  const referenceLength = 5.0; // 5 meters
  const referencePixels = 500; // 500 pixels
  const calculatedPixelsPerMeter = referencePixels / referenceLength;
  console.log('Calibration calculation:', {
    referenceLength,
    referencePixels,
    calculatedPixelsPerMeter,
    expected: 100
  });
  
  console.log('[CALIBRATION TEST] Calibration system test completed');
}

/**
 * Calculate the cost for a mask based on its area and material
 * Now supports mask-specific calibration overrides
 * 
 * @param mask - The mask to calculate cost for
 * @param materials - Array of available materials
 * @param globalPixelsPerMeter - Global calibration factor
 * @returns Cost information for the mask
 */
export function calculateMaskCost(
  mask: { 
    points: Point[]; 
    materialId?: string;
    customCalibration?: {
      estimatedLength?: number;
      estimatedWidth?: number;
      calibrationMethod: 'reference' | 'estimated' | 'auto';
      confidence: 'high' | 'medium' | 'low';
      lastUpdated: number;
    };
  },
  materials: Array<{ id: string; name: string; costPerSquareMeter?: number }>,
  globalPixelsPerMeter: number
): {
  areaSquareMeters: number;
  cost: number;
  materialName: string;
  hasCostData: boolean;
  calibrationMethod: 'global' | 'mask-specific';
  confidence: 'high' | 'medium' | 'low';
} {
  let areaSquareMeters: number;
  let calibrationMethod: 'global' | 'mask-specific' = 'global';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // Use mask-specific calibration if available
  if (mask.customCalibration?.estimatedLength && mask.customCalibration?.estimatedWidth) {
    // Calculate area using estimated dimensions
    const estimatedArea = mask.customCalibration.estimatedLength * mask.customCalibration.estimatedWidth;
    areaSquareMeters = estimatedArea;
    calibrationMethod = 'mask-specific';
    confidence = mask.customCalibration.confidence;
  } else {
    // Use global calibration
    areaSquareMeters = calculatePolygonAreaInSquareMeters(mask.points, globalPixelsPerMeter);
  }
  
  // Find material for this mask
  const material = materials.find(m => m.id === mask.materialId);
  let cost = 0;
  let materialName = 'No Material';
  let hasCostData = false;
  
  if (material) {
    materialName = material.name;
    if (material.costPerSquareMeter) {
      cost = areaSquareMeters * material.costPerSquareMeter;
      hasCostData = true;
    }
  }
  
  return {
    areaSquareMeters,
    cost,
    materialName,
    hasCostData,
    calibrationMethod,
    confidence
  };
}

/**
 * Calculate total project cost and area
 * 
 * @param masks - Array of masks
 * @param materials - Array of available materials
 * @param pixelsPerMeter - Calibration factor
 * @returns Total project information
 */
export function calculateProjectTotals(
  masks: Array<{ 
    points: Point[]; 
    materialId?: string;
    customCalibration?: {
      estimatedLength?: number;
      estimatedWidth?: number;
      calibrationMethod: 'reference' | 'estimated' | 'auto';
      confidence: 'high' | 'medium' | 'low';
      lastUpdated: number;
    };
  }>,
  materials: Array<{ id: string; name: string; costPerSquareMeter?: number }>,
  globalPixelsPerMeter: number
): {
  totalArea: number;
  totalCost: number;
  maskCount: number;
  masksWithCosts: number;
} {
  let totalArea = 0;
  let totalCost = 0;
  let masksWithCosts = 0;
  
  masks.forEach(mask => {
    const maskCost = calculateMaskCost(mask, materials, globalPixelsPerMeter);
    totalArea += maskCost.areaSquareMeters;
    totalCost += maskCost.cost;
    if (maskCost.hasCostData) {
      masksWithCosts++;
    }
  });
  
  return {
    totalArea,
    totalCost,
    maskCount: masks.length,
    masksWithCosts
  };
}

/**
 * Test function to verify measurement system works correctly
 * This can be called from the browser console for testing
 */
export function testMeasurementSystem(): void {
  console.log('[MEASUREMENT TEST] Testing measurement system...');
  
  // Test data
  const testMasks = [
    {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ],
      materialId: 'test-material-1'
    },
    {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 }
      ],
      materialId: 'test-material-2'
    }
  ];
  
  const testMaterials = [
    { id: 'test-material-1', name: 'Test Material 1', costPerSquareMeter: 25.0 },
    { id: 'test-material-2', name: 'Test Material 2', costPerSquareMeter: 15.0 }
  ];
  
  const pixelsPerMeter = 100; // 100 pixels per meter
  
  // Test individual mask cost calculation
  console.log('Testing individual mask cost calculation:');
  testMasks.forEach((mask, index) => {
    const cost = calculateMaskCost(mask, testMaterials, pixelsPerMeter);
    console.log(`Mask ${index + 1}:`, cost);
  });
  
  // Test project totals
  console.log('Testing project totals:');
  const totals = calculateProjectTotals(testMasks, testMaterials, pixelsPerMeter);
  console.log('Project totals:', totals);
  
  // Test polygon area calculation
  console.log('Testing polygon area calculation:');
  const testPolygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ];
  const areaPixels = calculatePolygonArea(testPolygon);
  const areaSquareMeters = calculatePolygonAreaInSquareMeters(testPolygon, pixelsPerMeter);
  console.log('Test polygon:', {
    areaPixels,
    areaSquareMeters,
    expectedPixels: 10000,
    expectedSquareMeters: 1.0
  });
  
  console.log('[MEASUREMENT TEST] Measurement system test completed');
}

/**
 * Comprehensive test for the entire calibration and measurement system
 * This can be called from the browser console for testing
 */
export function testCompleteCalibrationSystem(): void {
  console.log('[COMPLETE SYSTEM TEST] Testing complete calibration and measurement system...');
  
  // Test 1: Calibration system
  console.log('=== TEST 1: CALIBRATION SYSTEM ===');
  testCalibrationSystem();
  
  // Test 2: Measurement system
  console.log('=== TEST 2: MEASUREMENT SYSTEM ===');
  testMeasurementSystem();
  
  // Test 3: Integration test
  console.log('=== TEST 3: INTEGRATION TEST ===');
  
  // Simulate a real-world scenario
  const poolMasks = [
    {
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
        { x: 0, y: 300 }
      ],
      materialId: 'pool-interior',
      name: 'Pool Interior'
    },
    {
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 50 },
        { x: 0, y: 50 }
      ],
      materialId: 'waterline-tile',
      name: 'Waterline Tile'
    }
  ];
  
  const poolMaterials = [
    { id: 'pool-interior', name: 'Pool Interior Finish', costPerSquareMeter: 45.0 },
    { id: 'waterline-tile', name: 'Waterline Tile', costPerSquareMeter: 85.0 }
  ];
  
  // Simulate calibration: 500 pixels = 10 meters (50 px/m)
  const calibrationPixelsPerMeter = 50;
  
  console.log('Pool project simulation:');
  const projectTotals = calculateProjectTotals(poolMasks, poolMaterials, calibrationPixelsPerMeter);
  console.log('Project totals:', projectTotals);
  
  // Individual mask analysis
  poolMasks.forEach((mask, index) => {
    const maskCost = calculateMaskCost(mask, poolMaterials, calibrationPixelsPerMeter);
    console.log(`Mask ${index + 1} (${mask.name}):`, maskCost);
  });
  
  console.log('[COMPLETE SYSTEM TEST] Complete system test completed successfully!');
}

/**
 * Apply curve smoothing to a set of points
 * Uses a simple smoothing algorithm that creates smooth curves between points
 * 
 * @param points - Array of points to smooth
 * @param intensity - Smoothing intensity (0-100, where 100 is maximum smoothing)
 * @returns Array of smoothed points
 */
export function applyCurveSmoothing(points: Point[], intensity: number): Point[] {
  if (points.length < 3) return points; // Need at least 3 points for smoothing
  
  const smoothingFactor = intensity / 100; // Convert to 0-1 range
  const smoothedPoints: Point[] = [];
  
  // Always keep the first point
  smoothedPoints.push(points[0]);
  
  // Smooth intermediate points
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate smoothed position using weighted average
    const smoothedX = curr.x + smoothingFactor * ((prev.x + next.x) / 2 - curr.x);
    const smoothedY = curr.y + smoothingFactor * ((prev.y + next.y) / 2 - curr.y);
    
    smoothedPoints.push({ x: smoothedX, y: smoothedY });
  }
  
  // Always keep the last point
  smoothedPoints.push(points[points.length - 1]);
  
  return smoothedPoints;
}

/**
 * Generate additional points between existing points to create smoother curves
 * This creates more intermediate points for better curve representation
 * 
 * @param points - Array of points
 * @param intensity - Curve intensity (0-100)
 * @returns Array of points with additional intermediate points
 */
export function generateCurvePoints(points: Point[], intensity: number): Point[] {
  if (points.length < 2) return points;
  
  const curveFactor = intensity / 100;
  const result: Point[] = [];
  
  // Always include the first point
  result.push(points[0]);
  
  // Generate intermediate points between each pair
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    // Calculate number of intermediate points based on intensity
    const numIntermediate = Math.floor(curveFactor * 3); // 0-3 intermediate points
    
    for (let j = 1; j <= numIntermediate; j++) {
      const t = j / (numIntermediate + 1); // Interpolation factor
      
      // Linear interpolation with slight curve bias
      const x = current.x + t * (next.x - current.x);
      const y = current.y + t * (next.y - current.y);
      
      result.push({ x, y });
    }
    
    // Add the next point
    result.push(next);
  }
  
  return result;
}
