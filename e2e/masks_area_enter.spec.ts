import { test, expect } from '@playwright/test';

test.describe('Mask Area Tool Tests', () => {
  test('masks_area_enter.spec - Area tool drawing and finalization', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Switch to area tool
    await page.click('[data-testid="area-tool"], button:has-text("Area"), button:has-text("area")');
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    // Draw a mask by dragging
    const startX = canvasRect.x + canvasRect.width * 0.3;
    const startY = canvasRect.y + canvasRect.height * 0.3;
    const endX = canvasRect.x + canvasRect.width * 0.7;
    const endY = canvasRect.y + canvasRect.height * 0.7;
    
    // Start drawing
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    
    // Draw a path with multiple points
    const points = [
      { x: startX, y: startY },
      { x: startX + 50, y: startY + 30 },
      { x: startX + 100, y: startY + 20 },
      { x: startX + 120, y: startY + 60 },
      { x: endX, y: endY }
    ];
    
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(50); // Small delay between points
    }
    
    await page.mouse.up();
    
    // Finalize with Enter
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(500);
    
    // Verify mask was created by checking for green mask rendering
    const maskVisible = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Sample pixels to look for green mask color
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 50 && data[i + 1] > 200 && data[i + 2] < 50) {
          return true; // Found green pixel
        }
      }
      return false;
    });
    
    expect(maskVisible).toBe(true);
    
    // Test zoom/pan persistence
    await page.mouse.wheel(0, -200, { position: { x: canvasRect.x + canvasRect.width / 2, y: canvasRect.y + canvasRect.height / 2 } });
    await page.waitForTimeout(200);
    
    // Verify mask is still visible after zoom
    const maskStillVisible = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 50 && data[i + 1] > 200 && data[i + 2] < 50) {
          return true;
        }
      }
      return false;
    });
    
    expect(maskStillVisible).toBe(true);
    
    console.log('Area tool mask creation and persistence test completed successfully');
  });
});
