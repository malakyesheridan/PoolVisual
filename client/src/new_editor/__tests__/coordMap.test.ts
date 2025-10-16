// Unit Tests for Coordinate Mapping
import { describe, it, expect } from 'vitest';
import { screenToImage, imageToScreen } from '../utils';
import { PhotoSpace } from '../types';

describe('Coordinate Mapping', () => {
  const mockPhotoSpace: PhotoSpace = {
    scale: 1.5,
    panX: 100,
    panY: 50,
    imageWidth: 800,
    imageHeight: 600
  };

  describe('screenToImage', () => {
    it('should convert screen coordinates to image coordinates', () => {
      const screenPoint = { x: 200, y: 150 };
      const imagePoint = screenToImage(screenPoint, mockPhotoSpace);
      
      // Expected: (200 - 100) / 1.5 = 66.67, (150 - 50) / 1.5 = 66.67
      expect(imagePoint.x).toBeCloseTo(66.67, 1);
      expect(imagePoint.y).toBeCloseTo(66.67, 1);
    });

    it('should clamp coordinates to image bounds', () => {
      const screenPoint = { x: 1000, y: 1000 }; // Way outside image
      const imagePoint = screenToImage(screenPoint, mockPhotoSpace);
      
      // Should be clamped to image dimensions
      expect(imagePoint.x).toBe(800);
      expect(imagePoint.y).toBe(600);
    });

    it('should clamp negative coordinates to zero', () => {
      const screenPoint = { x: -100, y: -100 }; // Negative coordinates
      const imagePoint = screenToImage(screenPoint, mockPhotoSpace);
      
      // Should be clamped to zero
      expect(imagePoint.x).toBe(0);
      expect(imagePoint.y).toBe(0);
    });

    it('should handle different zoom levels', () => {
      const zoomedPhotoSpace = { ...mockPhotoSpace, scale: 0.75 };
      const screenPoint = { x: 200, y: 150 };
      const imagePoint = screenToImage(screenPoint, zoomedPhotoSpace);
      
      // Expected: (200 - 100) / 0.75 = 133.33, (150 - 50) / 0.75 = 133.33
      expect(imagePoint.x).toBeCloseTo(133.33, 1);
      expect(imagePoint.y).toBeCloseTo(133.33, 1);
    });

    it('should handle different pan values', () => {
      const pannedPhotoSpace = { ...mockPhotoSpace, panX: 200, panY: 100 };
      const screenPoint = { x: 200, y: 150 };
      const imagePoint = screenToImage(screenPoint, pannedPhotoSpace);
      
      // Expected: (200 - 200) / 1.5 = 0, (150 - 100) / 1.5 = 33.33
      expect(imagePoint.x).toBeCloseTo(0, 1);
      expect(imagePoint.y).toBeCloseTo(33.33, 1);
    });
  });

  describe('imageToScreen', () => {
    it('should convert image coordinates to screen coordinates', () => {
      const imagePoint = { x: 100, y: 75 };
      const screenPoint = imageToScreen(imagePoint, mockPhotoSpace);
      
      // Expected: 100 * 1.5 + 100 = 250, 75 * 1.5 + 50 = 162.5
      expect(screenPoint.x).toBeCloseTo(250, 1);
      expect(screenPoint.y).toBeCloseTo(162.5, 1);
    });

    it('should handle zero coordinates', () => {
      const imagePoint = { x: 0, y: 0 };
      const screenPoint = imageToScreen(imagePoint, mockPhotoSpace);
      
      // Expected: 0 * 1.5 + 100 = 100, 0 * 1.5 + 50 = 50
      expect(screenPoint.x).toBe(100);
      expect(screenPoint.y).toBe(50);
    });

    it('should handle maximum image coordinates', () => {
      const imagePoint = { x: 800, y: 600 };
      const screenPoint = imageToScreen(imagePoint, mockPhotoSpace);
      
      // Expected: 800 * 1.5 + 100 = 1300, 600 * 1.5 + 50 = 950
      expect(screenPoint.x).toBe(1300);
      expect(screenPoint.y).toBe(950);
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain accuracy in round-trip conversions', () => {
      const originalScreen = { x: 200, y: 150 };
      const imagePoint = screenToImage(originalScreen, mockPhotoSpace);
      const backToScreen = imageToScreen(imagePoint, mockPhotoSpace);
      
      // Should be very close to original (within 0.5px)
      expect(Math.abs(originalScreen.x - backToScreen.x)).toBeLessThan(0.5);
      expect(Math.abs(originalScreen.y - backToScreen.y)).toBeLessThan(0.5);
    });

    it('should handle edge cases in round-trip', () => {
      const originalScreen = { x: 0, y: 0 };
      const imagePoint = screenToImage(originalScreen, mockPhotoSpace);
      const backToScreen = imageToScreen(imagePoint, mockPhotoSpace);
      
      expect(Math.abs(originalScreen.x - backToScreen.x)).toBeLessThan(0.5);
      expect(Math.abs(originalScreen.y - backToScreen.y)).toBeLessThan(0.5);
    });
  });

  describe('clamping behavior', () => {
    it('should clamp screen coordinates that map outside image bounds', () => {
      const screenPoint = { x: 2000, y: 2000 }; // Way outside
      const imagePoint = screenToImage(screenPoint, mockPhotoSpace);
      
      expect(imagePoint.x).toBe(800); // Clamped to imageWidth
      expect(imagePoint.y).toBe(600); // Clamped to imageHeight
    });

    it('should clamp negative screen coordinates', () => {
      const screenPoint = { x: -500, y: -500 }; // Negative
      const imagePoint = screenToImage(screenPoint, mockPhotoSpace);
      
      expect(imagePoint.x).toBe(0); // Clamped to 0
      expect(imagePoint.y).toBe(0); // Clamped to 0
    });
  });
});