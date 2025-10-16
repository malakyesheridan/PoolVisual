/**
 * Grid utilities for canvas grid overlay and snapping
 */

export type GridConfig = {
  enabled: boolean;
  size: number;
  snapEnabled: boolean;
  color: string;
  opacity: number;
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: false,
  size: 10,
  snapEnabled: false,
  color: '#e5e7eb',
  opacity: 0.5,
};

/**
 * Generate grid lines for a given area
 */
export function generateGridLines(
  width: number,
  height: number,
  gridSize: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  
  // Vertical lines
  for (let x = offset.x % gridSize; x <= width; x += gridSize) {
    vertical.push(x);
  }
  
  // Horizontal lines
  for (let y = offset.y % gridSize; y <= height; y += gridSize) {
    horizontal.push(y);
  }
  
  return { vertical, horizontal };
}

/**
 * Snap a point to the nearest grid intersection
 */
export function snapToGrid(
  point: { x: number; y: number },
  gridSize: number
): { x: number; y: number } {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Check if a point is close to a grid line (for visual feedback)
 */
export function isNearGridLine(
  point: { x: number; y: number },
  gridSize: number,
  threshold: number = 5
): boolean {
  const snapped = snapToGrid(point, gridSize);
  const distance = Math.sqrt(
    Math.pow(point.x - snapped.x, 2) + Math.pow(point.y - snapped.y, 2)
  );
  return distance <= threshold;
}
