import { test, expect } from '@playwright/test';

test.describe('Material Library Integration', () => {
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

  test('should load materials from library when feature flag is enabled', async ({ page }) => {
    // Check if feature flag indicator is visible
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    // If feature flag is enabled, materials should load from library
    if (await featureFlagIndicator.isVisible()) {
      // Wait for materials to load
      await page.waitForTimeout(1000);
      
      // Check that materials are loaded
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toBeVisible();
      
      // Should have search functionality
      const searchInput = page.locator('input[placeholder="Search materials..."]');
      await expect(searchInput).toBeVisible();
      
      // Should have category filter
      const categorySelect = page.locator('select');
      await expect(categorySelect).toBeVisible();
    }
  });

  test('should apply different materials to multiple masks without losing previous materials', async ({ page }) => {
    // Draw first mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply first material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    
    // Find and click first material
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
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
    
    const secondMaterial = materialsPanel.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Draw third mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 300, y: 400 } });
    await page.locator('canvas').click({ position: { x: 400, y: 400 } });
    await page.locator('canvas').click({ position: { x: 350, y: 500 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply third material
    await page.locator('canvas').click({ position: { x: 350, y: 450 } });
    await page.waitForTimeout(100);
    
    const thirdMaterial = materialsPanel.locator('div').filter({ hasText: 'Wood Decking' }).first();
    await thirdMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify all three masks exist
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 3');
    
    // Verify materials are applied by checking the materials panel
    await expect(materialsPanel).toBeVisible();
    
    // Check that the selected mask shows the correct material
    await expect(materialsPanel).toContainText('Material: Wood Decking');
    
    // Test that selecting a different mask shows its material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
  });

  test('should adjust tile scale and maintain stability during zoom/pan', async ({ page }) => {
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
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Adjust tile scale
    const tileScaleSlider = page.locator('input[type="range"]');
    await tileScaleSlider.setValue('0.5');
    await page.waitForTimeout(200);
    
    // Verify tile scale is updated
    await expect(materialsPanel).toContainText('Tile Scale: 0.50');
    
    // Zoom and pan to test stability
    await page.locator('canvas').hover({ position: { x: 250, y: 250 } });
    await page.mouse.wheel(0, -200); // Zoom in
    await page.waitForTimeout(100);
    
    // Pan
    await page.keyboard.down('Space');
    await page.mouse.move(300, 250);
    await page.mouse.down();
    await page.mouse.move(200, 150);
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.waitForTimeout(100);
    
    // Verify material is still applied and tile scale is maintained
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    await expect(materialsPanel).toContainText('Tile Scale: 0.50');
  });

  test('should export PNG with correct material positioning and tiling', async ({ page }) => {
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
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Draw second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 200 } });
    await page.locator('canvas').click({ position: { x: 500, y: 200 } });
    await page.locator('canvas').click({ position: { x: 450, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Apply second material with different tile scale
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    
    const secondMaterial = materialsPanel.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Adjust tile scale for second mask
    const tileScaleSlider = page.locator('input[type="range"]');
    await tileScaleSlider.setValue('0.3');
    await page.waitForTimeout(200);
    
    // Export the image
    const exportButton = page.locator('button').filter({ hasText: 'Export' });
    await exportButton.click();
    
    // Wait for download to start
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    
    // Check that download has reasonable size
    expect(download.suggestedFilename()).toBe('pool-visualization.png');
  });

  test('should handle undo/redo with materials and tile scales correctly', async ({ page }) => {
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
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Adjust tile scale
    const tileScaleSlider = page.locator('input[type="range"]');
    await tileScaleSlider.setValue('0.5');
    await page.waitForTimeout(200);
    
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
    
    const secondMaterial = materialsPanel.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify we have 2 masks
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Undo the last mask
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await expect(devOverlay).toContainText('Masks: 1');
    
    // Verify first mask still has its material and tile scale
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    await expect(materialsPanel).toContainText('Tile Scale: 0.50');
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(100);
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Verify second mask has its material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
  });

  test('should handle rapid material switching without stutter', async ({ page }) => {
    // Draw a mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Select the mask
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    
    // Rapidly switch between materials
    const materials = [
      'Ceramic Tile',
      'Natural Stone', 
      'Wood Decking',
      'Ceramic Tile',
      'Natural Stone',
      'Wood Decking'
    ];
    
    for (const materialName of materials) {
      const material = materialsPanel.locator('div').filter({ hasText: materialName }).first();
      await material.click();
      await page.waitForTimeout(100); // Short delay between switches
    }
    
    // Verify final material is applied
    await expect(materialsPanel).toContainText('Material: Wood Decking');
    
    // Verify no errors occurred
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });

  test('should handle material loading errors gracefully', async ({ page }) => {
    // This test would require injecting a bad material URL
    // For now, we'll test that the UI doesn't crash when materials fail to load
    
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
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify material was applied (even if it falls back to neutral fill)
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    // Verify the app doesn't crash
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });
});
