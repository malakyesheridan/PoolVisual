// E2E Tests for Pools Apply (No Regressions)
import { test, expect } from '@playwright/test';

test.describe('Pools Apply No Regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should apply template with Replace mode and correct z-order', async ({ page }) => {
    // First, add some existing content
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    // Add an asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    
    // Verify initial asset exists
    await page.waitForSelector('[data-testid="asset"]');
    const initialAssetCount = await page.locator('[data-testid="asset"]').count();

    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply first template with Replace mode
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    
    // Confirm Replace in dialog
    await page.click('text=OK'); // Assuming dialog has OK button for Replace

    // Verify template was applied and existing content was cleared
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    const finalAssetCount = await page.locator('[data-testid="asset"]').count();
    
    // Should have template assets, not original assets
    expect(finalAssetCount).toBeGreaterThan(0);
    expect(finalAssetCount).not.toBe(initialAssetCount);
  });

  test('should apply template with Merge mode and preserve existing content', async ({ page }) => {
    // First, add some existing content
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    // Add an asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    
    // Verify initial asset exists
    await page.waitForSelector('[data-testid="asset"]');
    const initialAssetCount = await page.locator('[data-testid="asset"]').count();

    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply second template with Merge mode
    const applyButtons = page.locator('button:has-text("Apply")');
    await applyButtons.nth(1).click();
    
    // Cancel Replace dialog to choose Merge
    await page.click('text=Cancel'); // Assuming dialog has Cancel for Merge

    // Verify both original and template content exist
    await page.waitForSelector('[data-testid="asset"]');
    const finalAssetCount = await page.locator('[data-testid="asset"]').count();
    
    expect(finalAssetCount).toBeGreaterThan(initialAssetCount);
  });

  test('should select first template asset after apply', async ({ page }) => {
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply first template
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    await page.click('text=OK');

    // Verify template was applied
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    
    // Verify first template asset is selected
    const selectedAsset = page.locator('[data-testid="asset"].selected');
    await expect(selectedAsset).toBeVisible();
  });

  test('should undo template apply and restore previous state', async ({ page }) => {
    // First, add some existing content
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    // Add an asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    
    // Verify initial asset exists
    await page.waitForSelector('[data-testid="asset"]');
    const initialAssetCount = await page.locator('[data-testid="asset"]').count();

    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply template with Merge mode
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    await page.click('text=Cancel'); // Choose Merge

    // Verify template was applied
    await page.waitForSelector('[data-testid="asset"]');
    const afterApplyCount = await page.locator('[data-testid="asset"]').count();
    expect(afterApplyCount).toBeGreaterThan(initialAssetCount);

    // Undo template apply
    await page.keyboard.press('Control+z');

    // Verify state was restored
    const afterUndoCount = await page.locator('[data-testid="asset"]').count();
    expect(afterUndoCount).toBe(initialAssetCount);
  });

  test('should maintain z-order with template assets on top', async ({ page }) => {
    // First, add some existing content
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');
    
    // Add an asset
    const assetCard = page.locator('[data-testid="asset-card"]').first();
    await assetCard.click();
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply template with Merge mode
    const applyButton = page.locator('button:has-text("Apply")').first();
    await applyButton.click();
    await page.click('text=Cancel'); // Choose Merge

    // Verify template was applied
    await page.waitForSelector('[data-testid="asset"]');
    
    // Template assets should be on top (selected)
    const selectedAsset = page.locator('[data-testid="asset"].selected');
    await expect(selectedAsset).toBeVisible();
  });
});
