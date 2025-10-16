import { screenToImage, imageToScreen } from '../../src/utils/mapping';

describe('Overlay mapping round-trip', () => {
  const mockViewport = {
    getBoundingClientRect: () => ({ left: 100, top: 50 })
  } as HTMLElement;

  const camera = { scale: 2, panX: 10, panY: 20 };
  const dpr = 1.5;
  const imgFit = { originX: 5, originY: 10, imgScale: 0.8 };

  it('should round-trip within 0.5px for known image points', () => {
    const testPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 500, y: 300 },
      { x: 1000, y: 800 }
    ];

    testPoints.forEach(originalPoint => {
      const screenPoint = imageToScreen(
        originalPoint.x,
        originalPoint.y,
        mockViewport,
        camera,
        dpr,
        imgFit
      );

      const roundTripPoint = screenToImage(
        screenPoint.x,
        screenPoint.y,
        mockViewport,
        camera,
        dpr,
        imgFit
      );

      const error = Math.hypot(
        roundTripPoint.x - originalPoint.x,
        roundTripPoint.y - originalPoint.y
      );

      expect(error).toBeLessThan(0.5);
    });
  });

  it('should handle different zoom levels', () => {
    const testPoint = { x: 250, y: 150 };
    
    const zoomLevels = [0.5, 1, 1.5, 2, 3];
    
    zoomLevels.forEach(scale => {
      const cameraWithZoom = { ...camera, scale };
      
      const screenPoint = imageToScreen(
        testPoint.x,
        testPoint.y,
        mockViewport,
        cameraWithZoom,
        dpr,
        imgFit
      );

      const roundTripPoint = screenToImage(
        screenPoint.x,
        screenPoint.y,
        mockViewport,
        cameraWithZoom,
        dpr,
        imgFit
      );

      const error = Math.hypot(
        roundTripPoint.x - testPoint.x,
        roundTripPoint.y - testPoint.y
      );

      expect(error).toBeLessThan(0.5);
    });
  });

  it('should handle different DPR values', () => {
    const testPoint = { x: 300, y: 200 };
    
    const dprValues = [1, 1.25, 1.5, 2, 3];
    
    dprValues.forEach(dprValue => {
      const screenPoint = imageToScreen(
        testPoint.x,
        testPoint.y,
        mockViewport,
        camera,
        dprValue,
        imgFit
      );

      const roundTripPoint = screenToImage(
        screenPoint.x,
        screenPoint.y,
        mockViewport,
        camera,
        dprValue,
        imgFit
      );

      const error = Math.hypot(
        roundTripPoint.x - testPoint.x,
        roundTripPoint.y - testPoint.y
      );

      expect(error).toBeLessThan(0.5);
    });
  });
});
