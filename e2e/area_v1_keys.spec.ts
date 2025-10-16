import { test, expect } from '@playwright/test';

test.describe('Area V1 Keyboard Tests', () => {
  test('area_v1_keys.spec - V1 keyboard shortcuts and behavior', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Verify we're in V1 mode (default)
    const devChip = page.locator('text=MaskMode: AreaV1');
    await expect(devChip).toBeVisible();
    
    // Switch to area tool
    await page.click('[data-testid="area-tool"], button:has-text("Area"), button:has-text("area")');
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    // Focus canvas
    await canvasElement.click();
    
    // Start drawing
    const startX = canvasRect.x + canvasRect.width * 0.4;
    const startY = canvasRect.y + canvasRect.height * 0.4;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30);
    await page.mouse.move(startX + 100, startY + 20);
    await page.mouse.move(startX + 150, startY + 40);
    await page.mouse.up();
    
    // Test Backspace removes last point
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);
    
    // Test Esc cancels drawing
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    
    // Verify drawing was cancelled (no mask should be visible)
    const noMaskVisible = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return true;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 50 && data[i + 1] > 200 && data[i + 2] < 50) {
          return false; // Found green mask pixel
        }
      }
      return true;
    });
    
    expect(noMaskVisible).toBe(true);
    
    // Test Enter finalizes with enough points
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30);
    await page.mouse.move(startX + 100, startY + 20);
    await page.mouse.move(startX + 150, startY + 40);
    await page.mouse.up();
    
    // Finalize with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Verify mask was created
    const maskVisible = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 50 && data[i + 1] > 200 && data[i + 2] < 50) {
          return true; // Found green mask pixel
        }
      }
      return false;
    });
    
    expect(maskVisible).toBe(true);
    
    console.log('Area V1 keyboard shortcuts test completed successfully');
  });
});
