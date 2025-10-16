import { test, expect } from '@playwright/test';

test.describe('Material Library Loading Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    await page.waitForLoadState('networkidle');
    
    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
  });

  test('should show materials in the sidebar', async ({ page }) => {
    // Wait for materials to load
    await page.waitForTimeout(2000);
    
    // Check if feature flag indicator is visible
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    if (await featureFlagIndicator.isVisible()) {
      console.log('Material Library feature flag is enabled');
      
      // Check that materials panel is visible
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toBeVisible();
      
      // Check that we have materials loaded (not "No materials found")
      const noMaterialsMessage = page.locator('div').filter({ hasText: 'No materials found' });
      await expect(noMaterialsMessage).not.toBeVisible();
      
      // Check that we have at least one material card
      const materialCards = materialsPanel.locator('div').filter({ hasText: 'Ceramic Pool Tile' });
      await expect(materialCards.first()).toBeVisible();
      
      // Check that search input is visible
      const searchInput = page.locator('input[placeholder="Search materials..."]');
      await expect(searchInput).toBeVisible();
      
      // Check that category filter is visible
      const categorySelect = page.locator('select');
      await expect(categorySelect).toBeVisible();
      
      // Check that material count is displayed
      const materialCount = page.locator('div').filter({ hasText: /Showing \d+ of \d+ materials/ });
      await expect(materialCount).toBeVisible();
      
      console.log('Materials are properly loaded and displayed');
    } else {
      console.log('Material Library feature flag is disabled - using placeholder materials');
      
      // Should still show materials panel
      const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
      await expect(materialsPanel).toBeVisible();
    }
  });

  test('should apply material to selected mask', async ({ page }) => {
    // Wait for materials to load
    await page.waitForTimeout(2000);
    
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
    
    // Apply material
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    const firstMaterial = materialsPanel.locator('div').filter({ hasText: 'Ceramic Pool Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify material was applied
    await expect(materialsPanel).toContainText('Material: Ceramic Pool Tile');
    
    // Verify mask count
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });

  test('should show source information in dev mode', async ({ page }) => {
    // Wait for materials to load
    await page.waitForTimeout(2000);
    
    // Check if we're in dev mode and feature flag is enabled
    const featureFlagIndicator = page.locator('div').filter({ hasText: 'Material Library Enabled' });
    
    if (await featureFlagIndicator.isVisible()) {
      // Should show source information
      const sourceInfo = page.locator('div').filter({ hasText: /Source: (API|JSON|DEV)/ });
      await expect(sourceInfo).toBeVisible();
      
      // Should show clear cache button in dev mode
      const clearCacheButton = page.locator('button').filter({ hasText: 'Clear Cache' });
      await expect(clearCacheButton).toBeVisible();
      
      console.log('Source information and dev controls are visible');
    }
  });
});
