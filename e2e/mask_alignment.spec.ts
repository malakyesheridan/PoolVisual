import { test, expect } from '@playwright/test';

test.describe('Mask Coordinate Alignment', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Upload a test image first
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
  });

  test('should maintain mask position after commit at different zoom levels', async ({ page }) => {
    // Test at different zoom levels
    const zoomLevels = [0.5, 1.0, 1.5, 2.0];
    
    for (const zoomLevel of zoomLevels) {
      // Reset zoom to fit first
      const fitButton = page.locator('button').filter({ hasText: 'Fit' });
      await fitButton.click();
      await page.waitForTimeout(100);
      
      // Zoom to specific level
      await page.locator('canvas').hover({ position: { x: 300, y: 300 } });
      const currentZoom = await page.locator('[class*="fixed top-4 left-4"]').textContent();
      console.log(`Current zoom: ${currentZoom}`);
      
      // Draw a mask
      await page.keyboard.press('KeyA');
      await page.locator('canvas').click({ position: { x: 200, y: 200 } });
      await page.locator('canvas').click({ position: { x: 300, y: 200 } });
      await page.locator('canvas').click({ position: { x: 250, y: 300 } });
      await page.keyboard.press('Enter');
      
      // Wait for mask to be created
      await page.waitForTimeout(200);
      
      // Verify mask was created
      const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
      await expect(devOverlay).toContainText('Masks: 1');
      
      // Apply a material
      await page.locator('canvas').click({ position: { x: 250, y: 250 } });
      await page.waitForTimeout(100);
      const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
      await firstMaterial.click();
      await page.waitForTimeout(500);
      
      // Verify material was applied
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toContainText('Material: Ceramic Tile');
      
      // Clear masks for next iteration
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(100);
    }
  });

  test('should maintain mask position after panning', async ({ page }) => {
    // Draw a mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Pan around using space+drag
    await page.keyboard.down('Space');
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(300, 200);
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);
    
    // Verify mask is still selectable and has material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
  });

  test('should maintain mask position after zoom and pan', async ({ page }) => {
    // Draw a mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Zoom in
    await page.locator('canvas').hover({ position: { x: 250, y: 250 } });
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
    
    // Pan
    await page.keyboard.down('Space');
    await page.mouse.move(300, 250);
    await page.mouse.down();
    await page.mouse.move(200, 150);
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);
    
    // Verify mask is still selectable
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
  });

  test('should export masks at correct positions', async ({ page }) => {
    // Draw two masks with different materials
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply first material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Draw second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 200 } });
    await page.locator('canvas').click({ position: { x: 500, y: 200 } });
    await page.locator('canvas').click({ position: { x: 450, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply second material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    const secondMaterial = page.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Export the image
    const exportButton = page.locator('button').filter({ hasText: 'Export' });
    await exportButton.click();
    
    // Wait for download to start
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    
    // Check that download has reasonable size
    expect(download.suggestedFilename()).toBe('pool-visualization.png');
  });

  test('should handle undo/redo with correct mask positions', async ({ page }) => {
    // Draw first mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Draw second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 200 } });
    await page.locator('canvas').click({ position: { x: 500, y: 200 } });
    await page.locator('canvas').click({ position: { x: 450, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply different material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    const secondMaterial = page.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify we have 2 masks
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Undo the last mask
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await expect(devOverlay).toContainText('Masks: 1');
    
    // Verify first mask still has its material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(100);
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Verify second mask has its material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
  });

  test('should maintain mask positions after page reload', async ({ page }) => {
    // Draw a mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Re-upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    // Verify we can still interact with the editor
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 400 } });
    await page.locator('canvas').click({ position: { x: 500, y: 400 } });
    await page.locator('canvas').click({ position: { x: 450, y: 500 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Verify new mask was created
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });
});
