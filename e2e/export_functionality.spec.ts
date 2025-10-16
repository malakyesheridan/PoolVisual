// E2E Tests for Export Functionality
import { test, expect } from '@playwright/test';

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should export canvas with materials and assets', async ({ page }) => {
    // Add some content to export
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');
    
    // Select a material
    await page.click('[data-testid="material-card"]:first-child');
    
    // Draw a mask
    await page.keyboard.press('KeyA'); // Switch to area tool
    await page.click('canvas', { position: { x: 100, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 200 } });
    await page.click('canvas', { position: { x: 100, y: 200 } });
    await page.keyboard.press('Enter');
    
    // Add an asset
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    // Drag an asset to canvas
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.dragTo(page.locator('canvas'));
    
    // Export using Ctrl+E
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+e');
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/pool-visual-export-.*\.png/);
    
    // Verify success toast appears
    await expect(page.locator('text=Export Complete')).toBeVisible();
    await expect(page.locator('text=×')).toBeVisible(); // Dimensions should be shown
  });

  test('should handle export timeout gracefully', async ({ page }) => {
    // Mock slow asset loading to test timeout
    await page.route('**/assets/**', route => {
      // Delay response to simulate slow loading
      setTimeout(() => route.continue(), 2000);
    });

    // Add content
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.dragTo(page.locator('canvas'));

    // Export with short timeout
    await page.evaluate(() => {
      // Mock export with short timeout
      window.testExportTimeout = 1000;
    });

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+e');
    
    const download = await downloadPromise;
    
    // Should still export (with fallback to thumbnails)
    expect(download.suggestedFilename()).toMatch(/pool-visual-export-.*\.png/);
  });

  test('should show export error for invalid canvas', async ({ page }) => {
    // Mock canvas error
    await page.evaluate(() => {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        throw new Error('Canvas export failed');
      };
    });

    // Try to export
    await page.keyboard.press('Control+e');
    
    // Should show error toast
    await expect(page.locator('text=Export Failed')).toBeVisible();
    await expect(page.locator('text=Canvas export failed')).toBeVisible();
  });

  test('should export with different formats', async ({ page }) => {
    // Add content
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');
    await page.click('[data-testid="material-card"]:first-child');
    
    // Draw a mask
    await page.keyboard.press('KeyA');
    await page.click('canvas', { position: { x: 100, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 200 } });
    await page.click('canvas', { position: { x: 100, y: 200 } });
    await page.keyboard.press('Enter');

    // Test PNG export
    const pngDownloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+e');
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);

    // Test JPEG export (if implemented)
    await page.evaluate(() => {
      // Mock JPEG export
      window.testExportFormat = 'jpeg';
    });

    const jpegDownloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+e');
    const jpegDownload = await jpegDownloadPromise;
    expect(jpegDownload.suggestedFilename()).toMatch(/\.(jpg|jpeg)$/);
  });
});
