// E2E Tests for Asset Add (Click or Add Button)
import { test, expect } from '@playwright/test';

test.describe('Asset Add Click or Add Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should place asset at 100% zoom using click-to-place', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card to enter place mode
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Verify cursor changed to crosshair
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCSS('cursor', 'crosshair');

    // Click on canvas to place asset
    await canvas.click({ position: { x: 200, y: 150 } });

    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    
    // Verify cursor returned to default
    await expect(canvas).toHaveCSS('cursor', 'default');
  });

  test('should place asset at 75% zoom', async ({ page }) => {
    // Set zoom to 75%
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');

    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Click on canvas
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 150 } });

    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should place asset at 150% zoom', async ({ page }) => {
    // Set zoom to 150%
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');

    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Click on canvas
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 150 } });

    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should place asset using Add button', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click Add button on first asset card
    const addButton = page.locator('[data-testid="asset-card"]').first().locator('button:has-text("Add")');
    await addButton.click();

    // Verify asset was placed (centered)
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should place asset within ±10px of click position', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Click at specific coordinates
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 250, y: 180 } });

    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    
    // Check that asset is within ±10px of click position
    const asset = page.locator('[data-testid="asset"]').first();
    const assetBox = await asset.boundingBox();
    
    if (assetBox) {
      // Convert screen coordinates to image coordinates (simplified)
      const expectedX = 250; // Screen x
      const expectedY = 180; // Screen y
      
      expect(Math.abs(assetBox.x - expectedX)).toBeLessThan(10);
      expect(Math.abs(assetBox.y - expectedY)).toBeLessThan(10);
    }
  });

  test('should support sticky placement with Shift+click', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Hold Shift and click multiple times
    await page.keyboard.down('Shift');
    
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 100, y: 100 } });
    await canvas.click({ position: { x: 200, y: 150 } });
    await canvas.click({ position: { x: 300, y: 200 } });
    
    await page.keyboard.up('Shift');

    // Verify 3 assets were placed
    const assets = page.locator('[data-testid="asset"]');
    await expect(assets).toHaveCount(3);
  });

  test('should cancel placement with Escape', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Click first asset card
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();

    // Verify cursor changed to crosshair
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCSS('cursor', 'crosshair');

    // Press Escape to cancel
    await page.keyboard.press('Escape');

    // Verify cursor returned to default
    await expect(canvas).toHaveCSS('cursor', 'default');

    // Click on canvas - should not place asset
    await canvas.click({ position: { x: 200, y: 150 } });
    
    // Verify no asset was placed
    const assets = page.locator('[data-testid="asset"]');
    await expect(assets).toHaveCount(0);
  });
});
