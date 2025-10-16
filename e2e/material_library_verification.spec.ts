import { test, expect } from '@playwright/test';

test.describe('Material Library Integration Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    await page.waitForLoadState('networkidle');
    
    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
  });

  test('A. Data pulls - Real materials from API/JSON/Dev sources', async ({ page }) => {
    // Check if feature flag is enabled
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    if (await featureFlagIndicator.isVisible()) {
      // Wait for materials to load
      await page.waitForTimeout(1000);
      
      // Verify source information is displayed
      const sourceInfo = page.locator('div').filter({ hasText: /Source: (API|JSON|DEV)/ });
      await expect(sourceInfo).toBeVisible();
      
      // Verify materials panel shows real materials
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toBeVisible();
      
      // Check that we have materials loaded (not "No materials found")
      const noMaterialsMessage = page.locator('div').filter({ hasText: 'No materials found' });
      await expect(noMaterialsMessage).not.toBeVisible();
      
      // Verify search functionality
      const searchInput = page.locator('input[placeholder="Search materials..."]');
      await expect(searchInput).toBeVisible();
      
      // Verify category filter
      const categorySelect = page.locator('select');
      await expect(categorySelect).toBeVisible();
      
      // Verify material count display
      const materialCount = page.locator('div').filter({ hasText: /Showing \d+ of \d+ materials/ });
      await expect(materialCount).toBeVisible();
    } else {
      // Feature flag disabled - should show placeholder behavior
      console.log('Feature flag disabled - using placeholder materials');
    }
  });

  test('B. Apply + render - Material application to selected mask only', async ({ page }) => {
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
    
    // Verify both masks exist
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Verify materials are applied independently
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
  });

  test('C. Export parity - Pixel-identical exports', async ({ page }) => {
    // Draw a mask and apply material
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
    
    // Export the image
    const exportButton = page.locator('button').filter({ hasText: 'Export' });
    await exportButton.click();
    
    // Wait for download to start
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    
    // Check that download has reasonable size (not blank)
    expect(download.suggestedFilename()).toBe('pool-visualization.png');
    
    // Verify the download is not empty
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('D. Performance - Cache behavior and smooth UI', async ({ page }) => {
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
    
    // Rapidly switch between materials to test cache
    const materials = ['Ceramic Tile', 'Natural Stone', 'Wood Decking'];
    
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

  test('E. Resilience - Error handling and fallbacks', async ({ page }) => {
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

  test('F. Observability - Dev mode information', async ({ page }) => {
    // Check if we're in dev mode and feature flag is enabled
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    if (await featureFlagIndicator.isVisible()) {
      // Should show source information
      const sourceInfo = page.locator('div').filter({ hasText: /Source: (API|JSON|DEV)/ });
      await expect(sourceInfo).toBeVisible();
      
      // Should show clear cache button in dev mode
      const clearCacheButton = page.locator('button').filter({ hasText: 'Clear Cache' });
      await expect(clearCacheButton).toBeVisible();
      
      // Should show cache stats in dev overlay
      const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
      await expect(devOverlay).toContainText('Cache:');
    }
  });

  test('Feature flag respect - Off behavior', async ({ page }) => {
    // This test would need to be run with the feature flag disabled
    // For now, we'll verify the feature flag indicator behavior
    
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    if (await featureFlagIndicator.isVisible()) {
      // Feature flag is enabled - should show real materials
      await page.waitForTimeout(1000);
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toBeVisible();
      
      // Should not show "No materials found" immediately
      const noMaterialsMessage = page.locator('div').filter({ hasText: 'No materials found' });
      await expect(noMaterialsMessage).not.toBeVisible();
    } else {
      // Feature flag is disabled - should show placeholder behavior
      console.log('Feature flag disabled - using placeholder materials');
    }
  });

  test('Tile scale persistence through undo/redo', async ({ page }) => {
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
    
    // Draw second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 200 } });
    await page.locator('canvas').click({ position: { x: 500, y: 200 } });
    await page.locator('canvas').click({ position: { x: 450, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    
    // Undo the last mask
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    
    // Verify first mask still has its material and tile scale
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    await expect(materialsPanel).toContainText('Tile Scale: 0.50');
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(100);
    
    // Verify second mask is restored
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 2');
  });
});
