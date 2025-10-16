/**
 * Unit tests for clean masking system coordinate mapping
 */

import { screenToImage, imageToScreen } from './coord';
import type { Camera, ImageFit } from './coord';

// Mock viewport element
const createMockViewport = (left: number = 0, top: number = 0) => ({
  getBoundingClientRect: () => ({
    left,
    top,
    right: left + 800,
    bottom: top + 600,
    width: 800,
    height: 600
  })
}) as HTMLElement;

describe('Clean Mask Coordinate Mapping', () => {
  const camera: Camera = { scale: 1, panX: 0, panY: 0 };
  const imgFit: ImageFit = { originX: 0, originY: 0, scale: 1 };
  const dpr = 1;

  test('round-trip accuracy at DPR 1, scale 1', () => {
    const viewport = createMockViewport();
    const testPoints = [
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      { x: 700, y: 500 }
    ];

    testPoints.forEach(point => {
      const imagePoint = screenToImage(point.x, point.y, viewport, camera, dpr, imgFit);
      const screenPoint = imageToScreen(imagePoint.x, imagePoint.y, viewport, camera, dpr, imgFit);
      
      const errorX = Math.abs(screenPoint.x - point.x);
      const errorY = Math.abs(screenPoint.y - point.y);
      
      expect(errorX).toBeLessThanOrEqual(1);
      expect(errorY).toBeLessThanOrEqual(1);
    });
  });

  test('round-trip accuracy at DPR 1.5, scale 0.75', () => {
    const viewport = createMockViewport();
    const camera150: Camera = { scale: 0.75, panX: 50, panY: 50 };
    const dpr150 = 1.5;

    const testPoints = [
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      { x: 700, y: 500 }
    ];

    testPoints.forEach(point => {
      const imagePoint = screenToImage(point.x, point.y, viewport, camera150, dpr150, imgFit);
      const screenPoint = imageToScreen(imagePoint.x, imagePoint.y, viewport, camera150, dpr150, imgFit);
      
      const errorX = Math.abs(screenPoint.x - point.x);
      const errorY = Math.abs(screenPoint.y - point.y);
      
      expect(errorX).toBeLessThanOrEqual(1);
      expect(errorY).toBeLessThanOrEqual(1);
    });
  });

  test('round-trip accuracy at DPR 2, scale 1.5', () => {
    const viewport = createMockViewport();
    const camera200: Camera = { scale: 1.5, panX: -100, panY: -100 };
    const dpr200 = 2;

    const testPoints = [
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      { x: 700, y: 500 }
    ];

    testPoints.forEach(point => {
      const imagePoint = screenToImage(point.x, point.y, viewport, camera200, dpr200, imgFit);
      const screenPoint = imageToScreen(imagePoint.x, imagePoint.y, viewport, camera200, dpr200, imgFit);
      
      const errorX = Math.abs(screenPoint.x - point.x);
      const errorY = Math.abs(screenPoint.y - point.y);
      
      expect(errorX).toBeLessThanOrEqual(1);
      expect(errorY).toBeLessThanOrEqual(1);
    });
  });

  test('round-trip accuracy with image fit parameters', () => {
    const viewport = createMockViewport();
    const imgFitWithOffset: ImageFit = { originX: 50, originY: 50, scale: 0.8 };
    const cameraWithPan: Camera = { scale: 1.2, panX: 100, panY: 100 };

    const testPoints = [
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      { x: 700, y: 500 }
    ];

    testPoints.forEach(point => {
      const imagePoint = screenToImage(point.x, point.y, viewport, cameraWithPan, dpr, imgFitWithOffset);
      const screenPoint = imageToScreen(imagePoint.x, imagePoint.y, viewport, cameraWithPan, dpr, imgFitWithOffset);
      
      const errorX = Math.abs(screenPoint.x - point.x);
      const errorY = Math.abs(screenPoint.y - point.y);
      
      expect(errorX).toBeLessThanOrEqual(1);
      expect(errorY).toBeLessThanOrEqual(1);
    });
  });

  test('edge cases', () => {
    const viewport = createMockViewport();
    
    // Test zero coordinates
    const zeroPoint = screenToImage(0, 0, viewport, camera, dpr, imgFit);
    expect(zeroPoint.x).toBeCloseTo(0, 1);
    expect(zeroPoint.y).toBeCloseTo(0, 1);
    
    // Test negative coordinates
    const negPoint = screenToImage(-100, -100, viewport, camera, dpr, imgFit);
    expect(negPoint.x).toBeLessThan(0);
    expect(negPoint.y).toBeLessThan(0);
    
    // Test large coordinates
    const largePoint = screenToImage(1000, 1000, viewport, camera, dpr, imgFit);
    expect(largePoint.x).toBeGreaterThan(0);
    expect(largePoint.y).toBeGreaterThan(0);
  });
});
