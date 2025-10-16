import { test, expect } from '@playwright/test';

test.describe('Zoom Layout Lock Tests', () => {
  test('zoom_no_layout_shift.spec - Sidebar and viewport remain stable during zoom', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Capture initial layout measurements
    const sidebarElement = page.locator('[data-testid="materials-panel"], .materials-panel, aside').first();
    const viewportElement = page.locator('[data-editor-stage]').first();
    
    const initialSidebarRect = await sidebarElement.boundingBox();
    const initialViewportRect = await viewportElement.boundingBox();
    
    expect(initialSidebarRect).toBeTruthy();
    expect(initialViewportRect).toBeTruthy();
    
    // Perform 10 wheel zoom operations at cursor center
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    const centerX = canvasRect.x + canvasRect.width / 2;
    const centerY = canvasRect.y + canvasRect.height / 2;
    
    // Perform 10 zoom operations
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -100, { position: { x: centerX, y: centerY } });
      await page.waitForTimeout(50); // Small delay between zooms
    }
    
    // Wait for any animations to settle
    await page.waitForTimeout(200);
    
    // Capture final layout measurements
    const finalSidebarRect = await sidebarElement.boundingBox();
    const finalViewportRect = await viewportElement.boundingBox();
    
    // Calculate deltas
    const sidebarLeftDelta = Math.abs((finalSidebarRect?.x || 0) - (initialSidebarRect?.x || 0));
    const viewportWidthDelta = Math.abs((finalViewportRect?.width || 0) - (initialViewportRect?.width || 0));
    const viewportHeightDelta = Math.abs((finalViewportRect?.height || 0) - (initialViewportRect?.height || 0));
    
    // Assert layout stability - deltas should be ≤ 1px
    expect(sidebarLeftDelta).toBeLessThanOrEqual(1);
    expect(viewportWidthDelta).toBeLessThanOrEqual(1);
    expect(viewportHeightDelta).toBeLessThanOrEqual(1);
    
    console.log('Layout stability test results:', {
      sidebarLeftDelta,
      viewportWidthDelta,
      viewportHeightDelta
    });
  });
});
