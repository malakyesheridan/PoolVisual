// E2E Tests for Asset Drag & Drop
import { test, expect } from '@playwright/test';

test.describe('Asset Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should drag and drop assets at different zoom levels', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Test at 75% zoom
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');

    // Drag first asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    const canvas = page.locator('canvas');
    
    await assetCard.dragTo(canvas, { 
      targetPosition: { x: 200, y: 150 } 
    });

    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    
    // Test at 150% zoom
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');

    // Drag second asset
    const secondAsset = page.locator('[data-testid="asset-card"]').nth(1);
    await secondAsset.dragTo(canvas, { 
      targetPosition: { x: 300, y: 200 } 
    });

    // Verify second asset was placed
    const assets = page.locator('[data-testid="asset"]');
    await expect(assets).toHaveCount(2);
  });

  test('should use Add button as fallback', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click Add button on first asset
    const addButton = page.locator('[data-testid="asset-card"]').first().locator('button:has-text("Add")');
    await addButton.click();

    // Verify asset was placed at center
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    
    // Check console log for center placement
    const logs = await page.evaluate(() => {
      return window.console.logs || [];
    });
    
    expect(logs.some(log => log.includes('Add asset at center'))).toBeTruthy();
  });

  test('should handle drag outside canvas bounds', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Drag asset outside canvas
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    const outsideArea = page.locator('body');
    
    await assetCard.dragTo(outsideArea, { 
      targetPosition: { x: 50, y: 50 } 
    });

    // Should still place asset (clamped to bounds)
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should show telemetry in dev mode', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Listen for console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Drop telemetry')) {
        logs.push(msg.text());
      }
    });

    // Drag an asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    const canvas = page.locator('canvas');
    
    await assetCard.dragTo(canvas, { 
      targetPosition: { x: 200, y: 150 } 
    });

    // Verify telemetry was logged
    await page.waitForTimeout(1000); // Wait for logs
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toContain('Drop telemetry');
  });
});
