/**
 * Edge Calibration Utilities
 * Functions for extracting edges from masks and calculating weighted calibration
 */

import { Point } from './types';

export interface Edge {
  edgeIndex: number;
  startPoint: Point;
  endPoint: Point;
  pixelLength: number;
}

export interface EdgeMeasurement {
  edgeIndex: number;
  pixelLength: number;
  realWorldLength: number;
  pixelsPerMeter: number;
}

/**
 * Extract edges from a polygon (closed or open)
 */
export function extractMaskEdges(points: Point[], isClosed: boolean = true): Edge[] {
  if (points.length < 2) return [];
  
  const edges: Edge[] = [];
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const next = isClosed ? (i + 1) % n : i + 1;
    if (next >= n) break; // For open polylines, stop at last point
    
    const startPoint = points[i];
    const endPoint = points[next];
    const pixelLength = calculateDistance(startPoint, endPoint);
    
    edges.push({
      edgeIndex: i,
      startPoint,
      endPoint,
      pixelLength
    });
  }
  
  return edges;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate weighted average pixelsPerMeter from edge measurements
 * Weights by real-world length (longer edges have more influence)
 */
export function calculateWeightedPixelsPerMeter(
  edgeMeasurements: EdgeMeasurement[]
): number {
  if (edgeMeasurements.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  edgeMeasurements.forEach(edge => {
    const weight = edge.realWorldLength; // Weight by real-world length
    weightedSum += edge.pixelsPerMeter * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Validate edge measurements for consistency
 * Returns warnings if measurements seem inconsistent
 */
export function validateEdgeMeasurements(
  edges: Edge[],
  measurements: EdgeMeasurement[]
): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (measurements.length === 0) {
    return { isValid: false, warnings: ['No measurements provided'] };
  }
  
  // Check if opposite edges (for rectangular shapes) have similar real-world lengths
  if (edges.length >= 4 && measurements.length >= 2) {
    // For a rectangle, opposite edges should be similar
    const oppositePairs = [
      [0, 2], // First and third edge
      [1, 3]  // Second and fourth edge
    ];
    
    oppositePairs.forEach(([idx1, idx2]) => {
      const m1 = measurements.find(m => m.edgeIndex === idx1);
      const m2 = measurements.find(m => m.edgeIndex === idx2);
      
      if (m1 && m2) {
        const diff = Math.abs(m1.realWorldLength - m2.realWorldLength);
        const avg = (m1.realWorldLength + m2.realWorldLength) / 2;
        const diffPercent = (diff / avg) * 100;
        
        if (diffPercent > 20) {
          warnings.push(
            `Edges ${idx1 + 1} and ${idx2 + 1} have significantly different lengths (${diffPercent.toFixed(1)}% difference). ` +
            `This may indicate perspective distortion or measurement error.`
          );
        }
      }
    });
  }
  
  // Check for very small or very large measurements
  measurements.forEach(m => {
    if (m.realWorldLength < 0.1) {
      warnings.push(`Edge ${m.edgeIndex + 1} has a very small length (${m.realWorldLength}m). Please verify.`);
    }
    if (m.realWorldLength > 100) {
      warnings.push(`Edge ${m.edgeIndex + 1} has a very large length (${m.realWorldLength}m). Please verify.`);
    }
  });
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Calculate area using edge-based calibration
 * Uses weighted average of edge calibrations
 */
export function calculateAreaWithEdgeCalibration(
  points: Point[],
  edgeMeasurements: EdgeMeasurement[]
): number {
  if (edgeMeasurements.length === 0) return 0;
  
  // Calculate weighted average pixels per meter
  const avgPixelsPerMeter = calculateWeightedPixelsPerMeter(edgeMeasurements);
  
  if (avgPixelsPerMeter <= 0) return 0;
  
  // Calculate polygon area in pixels
  const areaPixels = calculatePolygonArea(points);
  
  // Convert to square meters using weighted average calibration
  return areaPixels / (avgPixelsPerMeter * avgPixelsPerMeter);
}

/**
 * Calculate polygon area using shoelace formula
 */
function calculatePolygonArea(points: Point[]): number {
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


