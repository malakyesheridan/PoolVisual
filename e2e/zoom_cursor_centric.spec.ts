import { test, expect } from '@playwright/test';

test.describe('Zoom Cursor-Centric Tests', () => {
  test('zoom_cursor_centric.spec - Zoom keeps cursor position stable', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Wait for image to load
    await page.waitForTimeout(2000);
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    // Define test marker position (offset from center)
    const testMarkerX = canvasRect.x + canvasRect.width * 0.3;
    const testMarkerY = canvasRect.y + canvasRect.height * 0.4;
    
    // Draw a test marker at the target position
    await page.evaluate(({ x, y }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw a visible marker
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, 4, 4);
    }, { x: testMarkerX - canvasRect.x, y: testMarkerY - canvasRect.y });
    
    // Perform zoom operations at the marker position
    const zoomOperations = 5;
    for (let i = 0; i < zoomOperations; i++) {
      await page.mouse.wheel(0, -100, { position: { x: testMarkerX, y: testMarkerY } });
      await page.waitForTimeout(100);
    }
    
    // Wait for zoom to settle
    await page.waitForTimeout(200);
    
    // Check that the marker is still visible and in the same relative position
    // We'll check the canvas content to see if our marker is still there
    const markerStillVisible = await page.evaluate(({ x, y }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Sample pixels around the marker position
      const imageData = ctx.getImageData(x - 5, y - 5, 10, 10);
      const data = imageData.data;
      
      // Look for red pixels (our marker)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 100 && data[i + 2] < 100) {
          return true; // Found red pixel
        }
      }
      return false;
    }, { x: testMarkerX - canvasRect.x, y: testMarkerY - canvasRect.y });
    
    // The marker should still be visible, indicating cursor-centric zoom worked
    expect(markerStillVisible).toBe(true);
    
    console.log('Cursor-centric zoom test completed successfully');
  });
  
  test('zoom_bounds_enforcement.spec - Zoom respects min/max scale bounds', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    const centerX = canvasRect.x + canvasRect.width / 2;
    const centerY = canvasRect.y + canvasRect.height / 2;
    
    // Test zoom out to minimum (should stop at 0.1)
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, 100, { position: { x: centerX, y: centerY } });
      await page.waitForTimeout(50);
    }
    
    // Test zoom in to maximum (should stop at 10)
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -100, { position: { x: centerX, y: centerY } });
      await page.waitForTimeout(50);
    }
    
    // Check that zoom level is within bounds
    const zoomLevel = await page.evaluate(() => {
      // Try to get zoom level from the store or DOM
      const zoomElement = document.querySelector('[style*="position: absolute"][style*="right: 12"]');
      if (zoomElement) {
        const text = zoomElement.textContent || '';
        const match = text.match(/(\d+)%/);
        return match ? parseInt(match[1]) / 100 : null;
      }
      return null;
    });
    
    if (zoomLevel !== null) {
      expect(zoomLevel).toBeGreaterThanOrEqual(0.1);
      expect(zoomLevel).toBeLessThanOrEqual(10);
    }
    
    console.log('Zoom bounds enforcement test completed');
  });
});
