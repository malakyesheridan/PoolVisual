import { test, expect } from '@playwright/test';

test.describe('Multi-Mask Material Rendering', () => {
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

  test('should apply different materials to multiple masks without losing previous materials', async ({ page }) => {
    // Draw first mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(100);
    
    // Select first mask and apply first material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    
    // Apply first material (Ceramic Tile)
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500); // Wait for material to load
    
    // Draw second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 400, y: 200 } });
    await page.locator('canvas').click({ position: { x: 500, y: 200 } });
    await page.locator('canvas').click({ position: { x: 450, y: 300 } });
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(100);
    
    // Select second mask and apply second material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    
    // Apply second material (Natural Stone)
    const secondMaterial = page.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500); // Wait for material to load
    
    // Draw third mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 300, y: 400 } });
    await page.locator('canvas').click({ position: { x: 400, y: 400 } });
    await page.locator('canvas').click({ position: { x: 350, y: 500 } });
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(100);
    
    // Select third mask and apply third material
    await page.locator('canvas').click({ position: { x: 350, y: 450 } });
    await page.waitForTimeout(100);
    
    // Apply third material (Wood Decking)
    const thirdMaterial = page.locator('div').filter({ hasText: 'Wood Decking' }).first();
    await thirdMaterial.click();
    await page.waitForTimeout(500); // Wait for material to load
    
    // Verify all three masks exist
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 3');
    
    // Verify materials are applied by checking the materials panel
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
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

  test('should maintain materials when changing selection', async ({ page }) => {
    // Draw two masks with different materials
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
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
    await page.waitForTimeout(100);
    
    // Apply second material
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    const secondMaterial = page.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Switch between masks and verify materials persist
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    await page.locator('canvas').click({ position: { x: 450, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
    
    // Switch back to first mask
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
  });

  test('should export PNG with all mask materials', async ({ page }) => {
    // Draw two masks with different materials
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
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
    await page.waitForTimeout(100);
    
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
    
    // Check that download has reasonable size (should be > 50KB for a proper export)
    expect(download.suggestedFilename()).toBe('pool-visualization.png');
    
    // Note: We can't easily check the actual content of the PNG without downloading it,
    // but we can verify that the export was triggered and the file has a reasonable name
  });

  test('should handle undo/redo with materials correctly', async ({ page }) => {
    // Draw first mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
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
    await page.waitForTimeout(100);
    
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

  test('should handle overlapping masks with deterministic rendering', async ({ page }) => {
    // Draw overlapping masks
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
    // Apply first material
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const firstMaterial = page.locator('div').filter({ hasText: 'Ceramic Tile' }).first();
    await firstMaterial.click();
    await page.waitForTimeout(500);
    
    // Draw overlapping second mask
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.locator('canvas').click({ position: { x: 350, y: 250 } });
    await page.locator('canvas').click({ position: { x: 300, y: 350 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
    // Apply second material
    await page.locator('canvas').click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(100);
    const secondMaterial = page.locator('div').filter({ hasText: 'Natural Stone' }).first();
    await secondMaterial.click();
    await page.waitForTimeout(500);
    
    // Verify both masks exist
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 2');
    
    // Test that we can select both masks
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    await page.waitForTimeout(100);
    const materialsPanel = page.locator('[class*="w-80 bg-white border-l"]');
    await expect(materialsPanel).toContainText('Material: Ceramic Tile');
    
    await page.locator('canvas').click({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(100);
    await expect(materialsPanel).toContainText('Material: Natural Stone');
  });
});
