// Legacy Area Mask Implementation (V1) - Based on editor2 behavior
import { Point, PhotoSpace } from './types';

export interface LegacyMaskState {
  isDrawing: boolean;
  points: Point[];
  smoothedPoints: Point[];
  lastPoint?: Point;
  lastTime: number;
  pointerId?: number;
}

export class LegacyAreaMaskV1 {
  private state: LegacyMaskState = {
    isDrawing: false,
    points: [],
    smoothedPoints: [],
    lastTime: 0
  };

  private readonly DISTANCE_THRESHOLD = 2.0; // pixels in image space
  private readonly TIME_THRESHOLD = 10; // ms
  private readonly MAX_POINTS = 10000; // cap to prevent runaway arrays

  // PHASE 1: Dual implementation - API surface
  beginAreaStroke(x: number, y: number, timestamp: number, pointerId?: number): LegacyMaskState {
    this.state = {
      isDrawing: true,
      points: [{ x, y }],
      smoothedPoints: [{ x, y }],
      lastPoint: { x, y },
      lastTime: timestamp,
      pointerId
    };
    return this.state;
  }

  appendPoint(x: number, y: number, timestamp: number): LegacyMaskState | null {
    if (!this.state.isDrawing) return null;

    const newPoint = { x, y };
    const now = timestamp;

    // PHASE 2: Legacy behavior - distance OR time threshold
    const shouldAdd = this.shouldAddPoint(newPoint, now);
    
    if (shouldAdd) {
      this.state.points.push(newPoint);
      this.state.lastPoint = newPoint;
      this.state.lastTime = now;

      // Cap points to prevent runaway arrays
      if (this.state.points.length > this.MAX_POINTS) {
        this.state.points = this.state.points.slice(-this.MAX_POINTS);
      }

      // Apply smoothing
      this.state.smoothedPoints = this.applySmoothing(this.state.points);
    }

    return this.state;
  }

  popPoint(): LegacyMaskState | null {
    if (!this.state.isDrawing || this.state.points.length <= 1) return null;

    this.state.points.pop();
    this.state.smoothedPoints = this.applySmoothing(this.state.points);
    
    if (this.state.points.length > 0) {
      this.state.lastPoint = this.state.points[this.state.points.length - 1];
    }

    return this.state;
  }

  cancel(): LegacyMaskState {
    this.state = {
      isDrawing: false,
      points: [],
      smoothedPoints: [],
      lastTime: 0
    };
    return this.state;
  }

  finalize(): LegacyMaskState | null {
    if (!this.state.isDrawing || this.state.points.length < 3) return null;

    // PHASE 2: Legacy behavior - RDP simplification for final result
    const simplifiedPoints = this.applyRDP(this.state.smoothedPoints, 1.5);
    
    this.state = {
      isDrawing: false,
      points: simplifiedPoints,
      smoothedPoints: simplifiedPoints,
      lastTime: 0
    };

    return this.state;
  }

  getState(): LegacyMaskState {
    return { ...this.state };
  }

  // PHASE 2: Legacy behavior - distance OR time threshold
  private shouldAddPoint(newPoint: Point, timestamp: number): boolean {
    if (!this.state.lastPoint) return true;

    const distance = Math.sqrt(
      Math.pow(newPoint.x - this.state.lastPoint.x, 2) + 
      Math.pow(newPoint.y - this.state.lastPoint.y, 2)
    );

    const timeDelta = timestamp - this.state.lastTime;

    return distance >= this.DISTANCE_THRESHOLD || timeDelta >= this.TIME_THRESHOLD;
  }

  // PHASE 2: Legacy behavior - Catmull-Rom spline smoothing
  private applySmoothing(points: Point[]): Point[] {
    if (points.length < 3) return points;

    const smoothed: Point[] = [];
    
    // Add first point
    smoothed.push(points[0]);

    // Apply quadratic Bézier smoothing between points
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      // Simple quadratic Bézier control point
      const controlX = (current.x + next.x) / 2;
      const controlY = (current.y + next.y) / 2;
      
      // Add intermediate points for smooth curve
      for (let t = 0.25; t < 1; t += 0.25) {
        const x = this.quadraticBezier(current.x, controlX, next.x, t);
        const y = this.quadraticBezier(current.y, controlY, next.y, t);
        smoothed.push({ x, y });
      }
    }

    // Add last point
    smoothed.push(points[points.length - 1]);

    return smoothed;
  }

  private quadraticBezier(p0: number, p1: number, p2: number, t: number): number {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }

  // PHASE 2: Legacy behavior - RDP simplification
  private applyRDP(points: Point[], threshold: number): Point[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.pointToLineDistance(points[i], points[0], points[points.length - 1]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > threshold) {
      const left = this.applyRDP(points.slice(0, maxIndex + 1), threshold);
      const right = this.applyRDP(points.slice(maxIndex), threshold);
      return [...left.slice(0, -1), ...right];
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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
}
