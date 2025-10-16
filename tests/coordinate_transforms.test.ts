import { describe, test, expect } from 'vitest';
import { screenToImage, imageToScreen, debugCoordinateTransform } from '../client/src/new_editor/utils';
import { PhotoSpace } from '../client/src/new_editor/types';

describe('Coordinate Transformations', () => {
  const createPhotoSpace = (scale: number, panX: number, panY: number): PhotoSpace => ({
    scale,
    panX,
    panY,
    imgW: 1000,
    imgH: 1000,
    dpr: 1
  });

  test('screenToImage should convert coordinates correctly', () => {
    const photoSpace = createPhotoSpace(2, 100, 50);
    
    // Test basic conversion
    const screenPoint = { x: 200, y: 150 };
    const imagePoint = screenToImage(screenPoint, photoSpace);
    
    expect(imagePoint.x).toBeCloseTo(50); // (200 - 100) / 2
    expect(imagePoint.y).toBeCloseTo(50); // (150 - 50) / 2
  });

  test('imageToScreen should convert coordinates correctly', () => {
    const photoSpace = createPhotoSpace(2, 100, 50);
    
    // Test basic conversion
    const imagePoint = { x: 50, y: 50 };
    const screenPoint = imageToScreen(imagePoint, photoSpace);
    
    expect(screenPoint.x).toBeCloseTo(200); // 50 * 2 + 100
    expect(screenPoint.y).toBeCloseTo(150); // 50 * 2 + 50
  });

  test('round-trip conversion should be accurate', () => {
    const photoSpace = createPhotoSpace(1.5, 200, 100);
    
    const originalScreen = { x: 300, y: 250 };
    const imagePoint = screenToImage(originalScreen, photoSpace);
    const backToScreen = imageToScreen(imagePoint, photoSpace);
    
    expect(backToScreen.x).toBeCloseTo(originalScreen.x, 5);
    expect(backToScreen.y).toBeCloseTo(originalScreen.y, 5);
  });

  test('round-trip conversion should work with extreme values', () => {
    const testCases = [
      { scale: 0.25, panX: -1000, panY: -1000 },
      { scale: 4.0, panX: 1000, panY: 1000 },
      { scale: 0.1, panX: 0, panY: 0 },
      { scale: 10.0, panX: -500, panY: 500 }
    ];

    for (const testCase of testCases) {
      const photoSpace = createPhotoSpace(testCase.scale, testCase.panX, testCase.panY);
      
      const originalScreen = { x: 500, y: 300 };
      const imagePoint = screenToImage(originalScreen, photoSpace);
      const backToScreen = imageToScreen(imagePoint, photoSpace);
      
      expect(backToScreen.x).toBeCloseTo(originalScreen.x, 5);
      expect(backToScreen.y).toBeCloseTo(originalScreen.y, 5);
    }
  });

  test('debugCoordinateTransform should detect mismatches', () => {
    const photoSpace = createPhotoSpace(2, 100, 50);
    const screenPoint = { x: 200, y: 150 };
    
    const debug = debugCoordinateTransform(screenPoint, photoSpace);
    
    expect(debug.original).toEqual(screenPoint);
    expect(debug.isValid).toBe(true);
    expect(debug.delta.x).toBeLessThan(0.5);
    expect(debug.delta.y).toBeLessThan(0.5);
  });

  test('coordinate transformations should handle edge cases', () => {
    // Test with zero scale (should not happen in practice, but should not crash)
    const photoSpaceZeroScale = createPhotoSpace(0, 100, 50);
    const screenPoint = { x: 200, y: 150 };
    
    const imagePoint = screenToImage(screenPoint, photoSpaceZeroScale);
    expect(imagePoint.x).toBe(Infinity);
    expect(imagePoint.y).toBe(Infinity);
    
    // Test with very small scale
    const photoSpaceSmallScale = createPhotoSpace(0.001, 100, 50);
    const imagePointSmall = screenToImage(screenPoint, photoSpaceSmallScale);
    expect(imagePointSmall.x).toBeCloseTo(100000); // (200 - 100) / 0.001
    expect(imagePointSmall.y).toBeCloseTo(100000); // (150 - 50) / 0.001
  });

  test('coordinate transformations should be consistent across DPR', () => {
    const photoSpace1 = createPhotoSpace(2, 100, 50);
    const photoSpace2 = { ...photoSpace1, dpr: 2 };
    
    const screenPoint = { x: 200, y: 150 };
    
    const imagePoint1 = screenToImage(screenPoint, photoSpace1);
    const imagePoint2 = screenToImage(screenPoint, photoSpace2);
    
    // DPR should not affect the coordinate transformation
    expect(imagePoint1.x).toBeCloseTo(imagePoint2.x);
    expect(imagePoint1.y).toBeCloseTo(imagePoint2.y);
  });

  test('multiple masks should maintain independent coordinates', () => {
    const photoSpace = createPhotoSpace(1.5, 200, 100);
    
    const mask1Points = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 150, y: 200 }
    ];
    
    const mask2Points = [
      { x: 300, y: 300 },
      { x: 400, y: 300 },
      { x: 350, y: 400 }
    ];
    
    // Convert both masks to screen space
    const mask1Screen = mask1Points.map(p => imageToScreen(p, photoSpace));
    const mask2Screen = mask2Points.map(p => imageToScreen(p, photoSpace));
    
    // Convert back to image space
    const mask1Back = mask1Screen.map(p => screenToImage(p, photoSpace));
    const mask2Back = mask2Screen.map(p => screenToImage(p, photoSpace));
    
    // Verify each mask maintains its original coordinates
    for (let i = 0; i < mask1Points.length; i++) {
      expect(mask1Back[i].x).toBeCloseTo(mask1Points[i].x, 5);
      expect(mask1Back[i].y).toBeCloseTo(mask1Points[i].y, 5);
    }
    
    for (let i = 0; i < mask2Points.length; i++) {
      expect(mask2Back[i].x).toBeCloseTo(mask2Points[i].x, 5);
      expect(mask2Back[i].y).toBeCloseTo(mask2Points[i].y, 5);
    }
  });
});
