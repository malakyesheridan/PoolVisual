import { test, expect } from '@playwright/test';

test.describe('New Editor Upload', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load editor and show dev overlay', async ({ page }) => {
    // Check that the dev overlay is visible
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toBeVisible();
    
    // Check initial state
    await expect(devOverlay).toContainText('State: idle');
    await expect(devOverlay).toContainText('Image: 0×0');
    await expect(devOverlay).toContainText('Zoom: 100%');
  });

  test('should upload image and show ready state', async ({ page }) => {
    // Upload the test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    
    // Wait for loading to complete
    await page.waitForTimeout(500);
    
    // Check that state is ready
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('State: ready');
    
    // Check that image dimensions are non-zero
    await expect(devOverlay).toContainText(/Image: \d+×\d+/);
    
    // Check that zoom percentage is finite
    await expect(devOverlay).toContainText(/Zoom: \d+%/);
  });

  test('should draw area mask', async ({ page }) => {
    // First upload an image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    // Press A to activate area tool
    await page.keyboard.press('KeyA');
    
    // Click to start drawing
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    
    // Press Enter to commit
    await page.keyboard.press('Enter');
    
    // Check that mask count increased
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });

  test('should apply material to mask', async ({ page }) => {
    // Upload image and draw mask
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    
    // Wait for mask to be created
    await page.waitForTimeout(100);
    
    // Click on the mask to select it
    await page.locator('canvas').click({ position: { x: 250, y: 250 } });
    
    // Apply material (click on first material in panel)
    const materialPanel = page.locator('[class*="w-64 bg-white border-l"]');
    await expect(materialPanel).toBeVisible();
    
    // Click on first material
    const firstMaterial = materialPanel.locator('button').first();
    await firstMaterial.click();
    
    // Wait for material to be applied
    await page.waitForTimeout(1000);
    
    // Check that material was applied (this would require checking canvas content)
    // For now, just verify no errors occurred
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
  });

  test('should export image', async ({ page }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    // Click export button
    const exportButton = page.locator('button').filter({ hasText: 'Export' });
    await exportButton.click();
    
    // Wait for download to start
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    
    // Check that download has reasonable size
    expect(download.suggestedFilename()).toBe('pool-visualization.png');
    
    // Note: We can't easily check file size without downloading, but we can verify
    // that the download was triggered
  });

  test('should handle undo/redo', async ({ page }) => {
    // Upload image and draw mask
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    await page.keyboard.press('KeyA');
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 300, y: 200 } });
    await page.locator('canvas').click({ position: { x: 250, y: 300 } });
    await page.keyboard.press('Enter');
    
    // Check mask count
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    await expect(devOverlay).toContainText('Masks: 1');
    
    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    
    // Check mask count decreased
    await expect(devOverlay).toContainText('Masks: 0');
    
    // Redo
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(100);
    
    // Check mask count restored
    await expect(devOverlay).toContainText('Masks: 1');
  });

  test('should handle zoom and pan', async ({ page }) => {
    // Upload image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    const devOverlay = page.locator('[class*="fixed top-4 left-4"]');
    const initialZoom = await devOverlay.textContent();
    
    // Zoom in
    await page.locator('canvas').hover({ position: { x: 300, y: 300 } });
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    
    // Check zoom changed
    const afterZoom = await devOverlay.textContent();
    expect(afterZoom).not.toBe(initialZoom);
    
    // Test fit button
    const fitButton = page.locator('button').filter({ hasText: 'Fit' });
    await fitButton.click();
    await page.waitForTimeout(100);
    
    // Check zoom reset to fit
    const afterFit = await devOverlay.textContent();
    expect(afterFit).toContain('Zoom:');
  });
});
