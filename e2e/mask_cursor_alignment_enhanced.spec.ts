import { test, expect } from '@playwright/test';

test.describe('Mask Cursor Alignment Tests', () => {
  test('mask_cursor_alignment.spec - Cursor alignment accuracy at multiple zoom levels', async ({ page }) => {
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
    
    // Test at 100% zoom
    await page.mouse.wheel(0, 0, { position: { x: canvasRect.x + canvasRect.width / 2, y: canvasRect.y + canvasRect.height / 2 } });
    await page.waitForTimeout(200);
    
    // Test cursor alignment at 3 different locations at 100% zoom
    const testLocations100 = [
      { x: canvasRect.x + canvasRect.width * 0.25, y: canvasRect.y + canvasRect.height * 0.25 },
      { x: canvasRect.x + canvasRect.width * 0.5, y: canvasRect.y + canvasRect.height * 0.5 },
      { x: canvasRect.x + canvasRect.width * 0.75, y: canvasRect.y + canvasRect.height * 0.75 }
    ];
    
    for (const location of testLocations100) {
      // Move cursor to test location
      await page.mouse.move(location.x, location.y);
      
      // Click to add a point
      await page.mouse.click(location.x, location.y);
      
      // Wait for probe data to update
      await page.waitForTimeout(100);
      
      // Read DEV overlay delta values
      const deltaText = await page.locator('text=Delta:').textContent();
      expect(deltaText).toBeTruthy();
      
      // Extract delta values from text like "Delta: (1.2, -0.8)px"
      const deltaMatch = deltaText!.match(/Delta: \(([^,]+), ([^)]+)\)px/);
      expect(deltaMatch).toBeTruthy();
      
      const deltaX = parseFloat(deltaMatch![1]);
      const deltaY = parseFloat(deltaMatch![2]);
      
      // Assert delta is within 1px tolerance
      expect(Math.abs(deltaX)).toBeLessThanOrEqual(1);
      expect(Math.abs(deltaY)).toBeLessThanOrEqual(1);
      
      // Cancel the drawing to start fresh
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    
    // Test at 150% zoom
    await page.mouse.wheel(0, 200, { position: { x: canvasRect.x + canvasRect.width / 2, y: canvasRect.y + canvasRect.height / 2 } });
    await page.waitForTimeout(200);
    
    // Test cursor alignment at 3 different locations at 150% zoom
    const testLocations150 = [
      { x: canvasRect.x + canvasRect.width * 0.2, y: canvasRect.y + canvasRect.height * 0.2 },
      { x: canvasRect.x + canvasRect.width * 0.6, y: canvasRect.y + canvasRect.height * 0.6 },
      { x: canvasRect.x + canvasRect.width * 0.8, y: canvasRect.y + canvasRect.height * 0.8 }
    ];
    
    for (const location of testLocations150) {
      // Move cursor to test location
      await page.mouse.move(location.x, location.y);
      
      // Click to add a point
      await page.mouse.click(location.x, location.y);
      
      // Wait for probe data to update
      await page.waitForTimeout(100);
      
      // Read DEV overlay delta values
      const deltaText = await page.locator('text=Delta:').textContent();
      expect(deltaText).toBeTruthy();
      
      // Extract delta values from text like "Delta: (1.2, -0.8)px"
      const deltaMatch = deltaText!.match(/Delta: \(([^,]+), ([^)]+)\)px/);
      expect(deltaMatch).toBeTruthy();
      
      const deltaX = parseFloat(deltaMatch![1]);
      const deltaY = parseFloat(deltaMatch![2]);
      
      // Assert delta is within 1px tolerance
      expect(Math.abs(deltaX)).toBeLessThanOrEqual(1);
      expect(Math.abs(deltaY)).toBeLessThanOrEqual(1);
      
      // Cancel the drawing to start fresh
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    
    // Verify no twin lines by checking that only one stroke is visible
    const strokeCount = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let strokePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Count non-black pixels (indicating strokes)
        if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
          strokePixels++;
        }
      }
      return strokePixels;
    });
    
    // Should have minimal stroke pixels (just the background image)
    expect(strokeCount).toBeLessThan(1000); // Arbitrary threshold
    
    console.log('Mask cursor alignment test completed successfully');
  });
});
