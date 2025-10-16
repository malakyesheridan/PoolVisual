import { test, expect } from '@playwright/test';

test.describe('Mask Focus and Keyboard Tests', () => {
  test('masks_focus_keys.spec - Focus management and keyboard shortcuts', async ({ page }) => {
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
    
    // Test canvas focus
    await canvasElement.click();
    
    // Verify canvas is focused (should have tabindex and be focusable)
    const isFocused = await canvasElement.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
    
    // Switch to area tool
    await page.click('[data-testid="area-tool"], button:has-text("Area"), button:has-text("area")');
    
    // Start drawing to auto-focus
    const startX = canvasRect.x + canvasRect.width * 0.4;
    const startY = canvasRect.y + canvasRect.height * 0.4;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30);
    await page.mouse.move(startX + 100, startY + 20);
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
    
    // Test that Enter doesn't cause page scroll or layout shifts
    const initialScrollY = await page.evaluate(() => window.scrollY);
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBe(initialScrollY);
    
    console.log('Focus and keyboard management test completed successfully');
  });
});
