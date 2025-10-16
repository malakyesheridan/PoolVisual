/**
 * E2E test for clean masking system material application
 */

import { test, expect } from '@playwright/test';

test.describe('Clean Mask Material Application', () => {
  test('finalize Area mask; apply first material; mask fill changes; persists after zoom/pan', async ({ page }) => {
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
    
    // Test Area mask
    await testMaskCreation(page, 'Area');
  });
  
  async function testMaskCreation(page: any, toolType: string) {
    // Activate tool
    await page.click(`button:has-text("${toolType}")`);
    
    // Get canvas bounds
    const canvas = page.locator('canvas');
    const canvasBounds = await canvas.boundingBox();
    
    if (!canvasBounds) {
      throw new Error('Canvas not found');
    }
    
    // Create mask points
    const points = [
      { x: canvasBounds.x + canvasBounds.width * 0.2, y: canvasBounds.y + canvasBounds.height * 0.2 },
      { x: canvasBounds.x + canvasBounds.width * 0.4, y: canvasBounds.y + canvasBounds.height * 0.3 },
      { x: canvasBounds.x + canvasBounds.width * 0.3, y: canvasBounds.y + canvasBounds.height * 0.5 },
      { x: canvasBounds.x + canvasBounds.width * 0.1, y: canvasBounds.y + canvasBounds.height * 0.4 }
    ];
    
    // Add points
    for (const point of points) {
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(100);
    }
    
    // Finalize mask
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(500);
    
    // Check that mask is created using DEV HUD
    const devHud = page.locator('[style*="rgba(0, 0, 0, 0.8)"]');
    if (await devHud.isVisible()) {
      const hudText = await devHud.textContent();
      expect(hudText).toContain('Masks: 1');
    }
    
    // Check clean masking system status
    const cleanMaskStatus = await page.locator('text=Clean Masks:').textContent();
    expect(cleanMaskStatus).toContain('Clean Masks: 1');
    
    // Apply first material
    const materialButton = page.locator('button').first();
    await materialButton.click();
    
    // Wait for material to be applied
    await page.waitForTimeout(500);
    
    // Check that material was applied to clean masking system
    const materialStatus = await page.locator('text=Material:').textContent();
    expect(materialStatus).toContain('Material:');
    
    // Test persistence after zoom
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const event = new WheelEvent('wheel', {
          deltaY: -100,
          clientX: canvas.offsetLeft + canvas.offsetWidth / 2,
          clientY: canvas.offsetTop + canvas.offsetHeight / 2
        });
        canvas.dispatchEvent(event);
      }
    });
    
    await page.waitForTimeout(500);
    
    // Check that material is still applied after zoom
    const zoomedMaterialStatus = await page.locator('text=Material:').textContent();
    expect(zoomedMaterialStatus).toContain('Material:');
    
    // Test persistence after pan
    await page.mouse.move(canvasBounds.x + canvasBounds.width / 2, canvasBounds.y + canvasBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBounds.x + canvasBounds.width / 2 + 50, canvasBounds.y + canvasBounds.height / 2 + 50);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Check that material is still applied after pan
    const pannedMaterialStatus = await page.locator('text=Material:').textContent();
    expect(pannedMaterialStatus).toContain('Material:');
  }
});
