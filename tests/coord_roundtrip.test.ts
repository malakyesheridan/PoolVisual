/**
 * PHASE 11 - Tests: Coordinate round-trip test
 * Round-trip imageToScreen→screenToImage across DPR {1, 1.5, 2} × scale {0.75, 1, 1.5} × imgScale {1, fitVal}
 * Error must be ≤ 1 px
 */

import { screenToImage, imageToScreen } from '../client/src/maskcore/coord';

// Mock viewport element
const createMockViewport = (width: number, height: number) => ({
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width,
    height
  })
}) as HTMLElement;

describe('Coordinate Round-trip Tests', () => {
  const testCases = [
    // DPR, camera scale, img scale
    { dpr: 1, camScale: 0.75, imgScale: 1 },
    { dpr: 1, camScale: 1, imgScale: 1 },
    { dpr: 1, camScale: 1.5, imgScale: 1 },
    { dpr: 1.5, camScale: 0.75, imgScale: 1 },
    { dpr: 1.5, camScale: 1, imgScale: 1 },
    { dpr: 1.5, camScale: 1.5, imgScale: 1 },
    { dpr: 2, camScale: 0.75, imgScale: 1 },
    { dpr: 2, camScale: 1, imgScale: 1 },
    { dpr: 2, camScale: 1.5, imgScale: 1 },
    // With image fit scaling
    { dpr: 1, camScale: 1, imgScale: 0.5 },
    { dpr: 1.5, camScale: 1, imgScale: 0.8 },
    { dpr: 2, camScale: 1, imgScale: 1.2 }
  ];

  testCases.forEach(({ dpr, camScale, imgScale }) => {
    test(`DPR ${dpr}, Scale ${camScale}, ImgScale ${imgScale}`, () => {
      const viewport = createMockViewport(800, 600);
      const camera = { scale: camScale, panX: 100, panY: 50 };
      const imgFit = { originX: 50, originY: 25, imgScale };

      // Test points across the image space
      const testPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 150 },
        { x: 400, y: 300 },
        { x: 800, y: 600 }
      ];

      testPoints.forEach(originalPoint => {
        // Round-trip: image → screen → image
        const screenPoint = imageToScreen(
          originalPoint.x,
          originalPoint.y,
          viewport,
          camera,
          dpr,
          imgFit
        );

        const roundTripPoint = screenToImage(
          screenPoint.x,
          screenPoint.y,
          viewport,
          camera,
          dpr,
          imgFit
        );

        const errorX = Math.abs(roundTripPoint.x - originalPoint.x);
        const errorY = Math.abs(roundTripPoint.y - originalPoint.y);

        expect(errorX).toBeLessThanOrEqual(1.0);
        expect(errorY).toBeLessThanOrEqual(1.0);

        if (errorX > 1.0 || errorY > 1.0) {
          console.error('Round-trip error > 1px:', {
            original: originalPoint,
            screen: screenPoint,
            roundTrip: roundTripPoint,
            error: { x: errorX, y: errorY },
            params: { dpr, camScale, imgScale }
          });
        }
      });
    });
  });
});
