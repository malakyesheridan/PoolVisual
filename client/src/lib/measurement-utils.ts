export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  points: Point[];
  holes?: Point[][];
}

export interface Line {
  points: Point[];
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Calculate the perimeter of a polygon
 */
export function calculatePolygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += calculateDistance(points[i], points[j]);
  }
  
  return perimeter;
}

/**
 * Calculate the length of a polyline
 */
export function calculateLineLength(points: Point[]): number {
  if (points.length < 2) return 0;
  
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += calculateDistance(points[i], points[i + 1]);
  }
  
  return length;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert pixels to meters using calibration
 */
export function pixelsToMeters(pixels: number, pixelsPerMeter: number): number {
  return pixels / pixelsPerMeter;
}

/**
 * Convert area from pixels² to m²
 */
export function pixelAreaToSquareMeters(pixelArea: number, pixelsPerMeter: number): number {
  return pixelArea / (pixelsPerMeter * pixelsPerMeter);
}

/**
 * Calculate waterline band area
 */
export function calculateWaterlineBandArea(
  perimeterMeters: number, 
  bandHeightMeters: number
): number {
  return perimeterMeters * bandHeightMeters;
}

/**
 * Apply wastage percentage to quantity
 */
export function applyWastage(quantity: number, wastagePercent: number): number {
  return quantity * (1 + wastagePercent / 100);
}

/**
 * Calculate labor cost using different rule types
 */
export function calculateLaborCost(
  ruleType: 'flat' | 'per_m2' | 'per_lm' | 'tiered',
  baseAmount: number,
  rate: number,
  quantity: number,
  tiers?: Array<{ threshold: number; rate: number }>
): number {
  switch (ruleType) {
    case 'flat':
      return baseAmount;
      
    case 'per_m2':
    case 'per_lm':
      return baseAmount + (rate * quantity);
      
    case 'tiered':
      if (!tiers) return baseAmount;
      
      let total = baseAmount;
      let remaining = quantity;
      
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const nextThreshold = i < tiers.length - 1 ? tiers[i + 1].threshold : Infinity;
        const tierQuantity = Math.min(remaining, nextThreshold - tier.threshold);
        
        if (tierQuantity > 0) {
          total += tierQuantity * tier.rate;
          remaining -= tierQuantity;
        }
        
        if (remaining <= 0) break;
      }
      
      return total;
      
    default:
      return baseAmount;
  }
}

/**
 * Calculate GST (tax) amount
 */
export function calculateGST(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100; // Banker's rounding
}

/**
 * Format currency value
 */
export function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Round to specified decimal places using banker's rounding
 */
export function roundToPrecision(value: number, precision: number = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}
