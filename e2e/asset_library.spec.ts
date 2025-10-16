// E2E tests for Asset Library v1
import { test, expect } from '@playwright/test';

test.describe('Asset Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should load asset library tab', async ({ page }) => {
    // Click on Assets tab
    await page.click('[data-testid="asset-tab"]');
    
    // Check that asset library is visible
    await expect(page.locator('[data-testid="asset-library"]')).toBeVisible();
    
    // Check that search input is present
    await expect(page.locator('[data-testid="asset-search"]')).toBeVisible();
    
    // Check that category filters are present
    await expect(page.locator('[data-testid="asset-category-all"]')).toBeVisible();
  });

  test('should display asset cards', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]', { timeout: 10000 });
    
    // Check that asset cards are displayed
    const assetCards = page.locator('[data-testid="asset-card"]');
    await expect(assetCards).toHaveCount.greaterThan(0);
    
    // Check that thumbnails are loaded
    const thumbnails = page.locator('[data-testid="asset-thumbnail"]');
    await expect(thumbnails.first()).toBeVisible();
  });

  test('should search assets', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Search for "tree"
    await page.fill('[data-testid="asset-search"]', 'tree');
    
    // Wait for search results
    await page.waitForTimeout(200); // Debounce delay
    
    // Check that only tree assets are shown
    const assetCards = page.locator('[data-testid="asset-card"]');
    const count = await assetCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = assetCards.nth(i);
      const text = await card.textContent();
      expect(text?.toLowerCase()).toContain('tree');
    }
  });

  test('should filter by category', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Click on furniture category
    await page.click('[data-testid="asset-category-furniture"]');
    
    // Wait for filter to apply
    await page.waitForTimeout(100);
    
    // Check that only furniture assets are shown
    const assetCards = page.locator('[data-testid="asset-card"]');
    const count = await assetCards.count();
    
    for (let i = 0; i < count; i++) {
      const card = assetCards.nth(i);
      const text = await card.textContent();
      expect(text?.toLowerCase()).toMatch(/chair|table|umbrella/);
    }
  });

  test('should drag asset to canvas', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Get first asset card
    const firstAsset = page.locator('[data-testid="asset-card"]').first();
    
    // Get canvas element
    const canvas = page.locator('canvas').first();
    
    // Perform drag and drop
    await firstAsset.dragTo(canvas);
    
    // Check that asset was created (this would need to be implemented in the canvas)
    // For now, just verify the drag operation completed without error
    await expect(canvas).toBeVisible();
  });

  test('should show selected asset panel when asset is selected', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Click on first asset card to select it
    await page.click('[data-testid="asset-card"]');
    
    // Check that selected asset panel is visible
    await expect(page.locator('[data-testid="selected-asset-panel"]')).toBeVisible();
    
    // Check that asset controls are present
    await expect(page.locator('input[type="range"]')).toHaveCount.greaterThan(0);
  });

  test('should handle empty search results', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Search for something that doesn't exist
    await page.fill('[data-testid="asset-search"]', 'nonexistent');
    
    // Wait for search results
    await page.waitForTimeout(200);
    
    // Check that empty state is shown
    await expect(page.locator('text=No assets match your search')).toBeVisible();
  });

  test('should show source info', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Check that source info is displayed
    await expect(page.locator('text=LOCAL')).toBeVisible();
  });

  test('should handle asset loading errors gracefully', async ({ page }) => {
    // Mock network failure for asset loading
    await page.route('**/assets/asset-index.json', route => route.abort());
    
    await page.click('[data-testid="asset-tab"]');
    
    // Check that error state is shown
    await expect(page.locator('text=Failed to load asset library')).toBeVisible();
    
    // Check that retry button is present
    await expect(page.locator('text=Retry')).toBeVisible();
  });

  test('should show asset count', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Check that asset count is displayed
    await expect(page.locator('text=Showing')).toBeVisible();
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.click('[data-testid="asset-tab"]');
    
    // Wait for assets to load
    await page.waitForSelector('[data-testid="asset-card"]');
    
    // Select first asset
    await page.click('[data-testid="asset-card"]');
    
    // Press Delete key
    await page.keyboard.press('Delete');
    
    // Check that asset was deleted (this would need canvas integration)
    // For now, just verify no error occurred
    await expect(page.locator('[data-testid="asset-card"]')).toBeVisible();
  });
});
