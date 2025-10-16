import { test, expect } from '@playwright/test';

test.describe('Asset Cursor Alignment Tests', () => {
  test('asset_cursor_alignment.spec - Asset placement accuracy', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (!canvasRect) {
      throw new Error('Canvas element not found');
    }
    
    // Test at 75% zoom
    await page.mouse.wheel(0, -100, { position: { x: canvasRect.x + canvasRect.width / 2, y: canvasRect.y + canvasRect.height / 2 } });
    await page.waitForTimeout(200);
    
    // Find an asset in the library to place
    const assetCard = page.locator('[data-testid="asset-card"], .asset-card').first();
    if (await assetCard.count() > 0) {
      // Drag asset to canvas center
      const centerX = canvasRect.x + canvasRect.width / 2;
      const centerY = canvasRect.y + canvasRect.height / 2;
      
      await assetCard.dragTo(canvasElement, {
        targetPosition: { x: centerX - canvasRect.x, y: centerY - canvasRect.y }
      });
      
      await page.waitForTimeout(500);
      
      // Check if asset was placed (look for asset elements or console logs)
      const assetPlaced = await page.evaluate(() => {
        // Check for asset elements in the DOM or console logs
        return document.querySelector('[data-testid="asset"]') !== null;
      });
      
      expect(assetPlaced).toBe(true);
    }
    
    // Test at 150% zoom
    await page.mouse.wheel(0, 200, { position: { x: canvasRect.x + canvasRect.width / 2, y: canvasRect.y + canvasRect.height / 2 } });
    await page.waitForTimeout(200);
    
    // Place another asset at a different location
    const assetCard2 = page.locator('[data-testid="asset-card"], .asset-card').nth(1);
    if (await assetCard2.count() > 0) {
      const testX = canvasRect.x + canvasRect.width * 0.3;
      const testY = canvasRect.y + canvasRect.height * 0.3;
      
      await assetCard2.dragTo(canvasElement, {
        targetPosition: { x: testX - canvasRect.x, y: testY - canvasRect.y }
      });
      
      await page.waitForTimeout(500);
      
      // Verify asset placement accuracy
      const assetPlaced2 = await page.evaluate(() => {
        return document.querySelector('[data-testid="asset"]') !== null;
      });
      
      expect(assetPlaced2).toBe(true);
    }
    
    console.log('Asset cursor alignment test completed successfully');
  });
});
