import { test, expect } from '@playwright/test';

test.describe('Area V1 Legacy Feel Tests', () => {
  test('area_v1_feel.spec - V1 legacy behavior and performance', async ({ page }) => {
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
    
    // Draw a complex zig-zag stroke to test smoothing and performance
    const startX = canvasRect.x + canvasRect.width * 0.2;
    const startY = canvasRect.y + canvasRect.height * 0.2;
    
    // Start drawing
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    
    // Create a zig-zag pattern with many points
    const points = [];
    for (let i = 0; i < 50; i++) {
      const x = startX + (i * 8) + (Math.sin(i * 0.5) * 20);
      const y = startY + (i * 3) + (Math.cos(i * 0.3) * 15);
      points.push({ x, y });
    }
    
    // Draw the zig-zag pattern
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(5); // Small delay to simulate real drawing
    }
    
    await page.mouse.up();
    
    // Finalize with Enter
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(500);
    
    // Verify mask was created and check console logs for V1 behavior
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('MASK_ACTION V1') || msg.text().includes('MASK_INPUT V1')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Verify V1-specific behavior in logs
    const v1Logs = consoleLogs.filter(log => log.includes('V1'));
    expect(v1Logs.length).toBeGreaterThan(0);
    
    // Check for smoothing evidence (raw vs smoothed points)
    const smoothingLog = v1Logs.find(log => log.includes('rawPoints') && log.includes('smoothedPoints'));
    expect(smoothingLog).toBeTruthy();
    
    // Verify mask persists after zoom/pan
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
          return true; // Found green mask pixel
        }
      }
      return false;
    });
    
    expect(maskStillVisible).toBe(true);
    
    console.log('Area V1 legacy feel test completed successfully');
    console.log('V1 logs captured:', v1Logs.length);
  });
});
