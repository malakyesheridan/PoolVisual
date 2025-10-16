// Tests to protect against regressions
import { screenToImage, imageToScreen } from './coord';

// Mock HTMLElement for testing
class MockHTMLElement {
  getBoundingClientRect() {
    return {
      left: 100,
      top: 50,
      width: 800,
      height: 600,
      right: 900,
      bottom: 650,
      x: 100,
      y: 50
    };
  }
}

const mockViewport = new MockHTMLElement() as any;

describe('Coordinate Mapping Tests', () => {
  test('Round-trip accuracy at 100% zoom with image parameters', () => {
    const camera = { scale: 1.0, panX: 0, panY: 0 };
    const dpr = 1;
    const img = { originX: 0, originY: 0, scale: 1 };
    
    const testPoints = [
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      { x: 700, y: 500 }
    ];
    
    for (const original of testPoints) {
      const imageCoords = screenToImage(
        original.x,
        original.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const screenCoords = imageToScreen(
        imageCoords.x,
        imageCoords.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const deltaX = Math.abs(screenCoords.x - original.x);
      const deltaY = Math.abs(screenCoords.y - original.y);
      
      expect(deltaX).toBeLessThanOrEqual(1);
      expect(deltaY).toBeLessThanOrEqual(1);
    }
  });

  test('Round-trip accuracy at 75% zoom with image parameters', () => {
    const camera = { scale: 0.75, panX: 50, panY: 25 };
    const dpr = 1.5;
    const img = { originX: 10, originY: 5, scale: 1 };
    
    const testPoints = [
      { x: 150, y: 125 },
      { x: 450, y: 325 },
      { x: 750, y: 525 }
    ];
    
    for (const original of testPoints) {
      const imageCoords = screenToImage(
        original.x,
        original.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const screenCoords = imageToScreen(
        imageCoords.x,
        imageCoords.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const deltaX = Math.abs(screenCoords.x - original.x);
      const deltaY = Math.abs(screenCoords.y - original.y);
      
      expect(deltaX).toBeLessThanOrEqual(1);
      expect(deltaY).toBeLessThanOrEqual(1);
    }
  });

  test('Round-trip accuracy at 150% zoom with image parameters', () => {
    const camera = { scale: 1.5, panX: -100, panY: -50 };
    const dpr = 2;
    const img = { originX: 20, originY: 10, scale: 1 };
    
    const testPoints = [
      { x: 200, y: 150 },
      { x: 500, y: 350 },
      { x: 800, y: 550 }
    ];
    
    for (const original of testPoints) {
      const imageCoords = screenToImage(
        original.x,
        original.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const screenCoords = imageToScreen(
        imageCoords.x,
        imageCoords.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const deltaX = Math.abs(screenCoords.x - original.x);
      const deltaY = Math.abs(screenCoords.y - original.y);
      
      expect(deltaX).toBeLessThanOrEqual(1);
      expect(deltaY).toBeLessThanOrEqual(1);
    }
  });

  test('DPR scaling accuracy with image parameters', () => {
    const camera = { scale: 1.0, panX: 0, panY: 0 };
    const img = { originX: 0, originY: 0, scale: 1 };
    
    // Test with different DPR values
    const dprValues = [1, 1.5, 2];
    const testPoint = { x: 200, y: 150 };
    
    for (const dpr of dprValues) {
      const imageCoords = screenToImage(
        testPoint.x,
        testPoint.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const screenCoords = imageToScreen(
        imageCoords.x,
        imageCoords.y,
        mockViewport,
        camera,
        dpr,
        img
      );
      
      const deltaX = Math.abs(screenCoords.x - testPoint.x);
      const deltaY = Math.abs(screenCoords.y - testPoint.y);
      
      expect(deltaX).toBeLessThanOrEqual(1);
      expect(deltaY).toBeLessThanOrEqual(1);
    }
  });

  test('Image origin and scale accuracy', () => {
    const camera = { scale: 1.0, panX: 100, panY: 50 };
    const dpr = 1;
    const img = { originX: 25, originY: 15, scale: 1.2 };
    
    const testPoint = { x: 300, y: 200 };
    
    const imageCoords = screenToImage(
      testPoint.x,
      testPoint.y,
      mockViewport,
      camera,
      dpr,
      img
    );
    
    const screenCoords = imageToScreen(
      imageCoords.x,
      imageCoords.y,
      mockViewport,
      camera,
      dpr,
      img
    );
    
    const deltaX = Math.abs(screenCoords.x - testPoint.x);
    const deltaY = Math.abs(screenCoords.y - testPoint.y);
    
    expect(deltaX).toBeLessThanOrEqual(1);
    expect(deltaY).toBeLessThanOrEqual(1);
  });
});
