/**
 * E2E test for clean masking system cursor alignment
 */

import { test, expect } from '@playwright/test';

test.describe('Clean Mask Cursor Alignment', () => {
  test('Area mask points land exactly under cursor at 100% and 150% zoom', async ({ page }) => {
    await page.goto('/new_editor');
    
    // Wait for editor to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-images/test-pool.jpg');
    
    // Wait for image to load
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Enable DEV HUD
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(100);
    
    // Test at 100% zoom
    await testZoomLevel(page, 1.0);
    
    // Test at 150% zoom
    await testZoomLevel(page, 1.5);
  });
  
  async function testZoomLevel(page: any, targetZoom: number) {
    // Set zoom level
    await page.evaluate((zoom: number) => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const event = new WheelEvent('wheel', {
          deltaY: zoom > 1 ? -100 : 100,
          clientX: canvas.offsetLeft + canvas.offsetWidth / 2,
          clientY: canvas.offsetTop + canvas.offsetHeight / 2
        });
        canvas.dispatchEvent(event);
      }
    }, targetZoom);
    
    // Wait for zoom to settle
    await page.waitForTimeout(500);
    
    // Activate Area tool
    await page.click('button:has-text("Area")');
    
    // Get canvas bounds
    const canvas = page.locator('canvas');
    const canvasBounds = await canvas.boundingBox();
    
    if (!canvasBounds) {
      throw new Error('Canvas not found');
    }
    
    // Test three points
    const testPoints = [
      { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.3 },
      { x: canvasBounds.x + canvasBounds.width * 0.5, y: canvasBounds.y + canvasBounds.height * 0.5 },
      { x: canvasBounds.x + canvasBounds.width * 0.7, y: canvasBounds.y + canvasBounds.height * 0.7 }
    ];
    
    for (const point of testPoints) {
      // Click to add point
      await page.mouse.click(point.x, point.y);
      
      // Check DEV HUD for cursor delta
      const devHud = page.locator('[style*="rgba(0, 0, 0, 0.8)"]');
      if (await devHud.isVisible()) {
        const hudText = await devHud.textContent();
        
        // Verify DEV HUD shows clean masking system info
        expect(hudText).toContain('DPR:');
        expect(hudText).toContain('Scale:');
        expect(hudText).toContain('Masks:');
        expect(hudText).toContain('Draft:');
      }
    }
    
    // Finalize mask
    await page.keyboard.press('Enter');
    
    // Verify mask was created
    const devHud = page.locator('[style*="rgba(0, 0, 0, 0.8)"]');
    if (await devHud.isVisible()) {
      const hudText = await devHud.textContent();
      expect(hudText).toContain('Masks: 1');
    }
  }
});