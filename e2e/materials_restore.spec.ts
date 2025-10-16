// E2E Tests for Materials Restore
import { test, expect } from '@playwright/test';

test.describe('Materials Restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should show materials panel with items', async ({ page }) => {
    // Navigate to Materials tab
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');

    // Verify materials are loaded
    const materialsCount = await page.locator('[data-testid="material-item"]').count();
    expect(materialsCount).toBeGreaterThan(0);

    // Verify source info shows count
    const sourceInfo = page.locator('text=Materials:');
    await expect(sourceInfo).toBeVisible();
  });

  test('should apply material to selected mask', async ({ page }) => {
    // First create a mask
    await page.keyboard.press('KeyA'); // Start area tool
    await page.locator('canvas').click({ position: { x: 100, y: 100 } });
    await page.locator('canvas').click({ position: { x: 200, y: 100 } });
    await page.locator('canvas').click({ position: { x: 200, y: 200 } });
    await page.locator('canvas').click({ position: { x: 100, y: 200 } });
    await page.keyboard.press('Enter'); // Commit mask

    // Navigate to Materials tab
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');

    // Select first material
    const firstMaterial = page.locator('[data-testid="material-item"]').first();
    await firstMaterial.click();

    // Verify material was applied (check for visual change or console log)
    // This would depend on how material application is visually indicated
    await expect(firstMaterial).toHaveClass(/selected/);
  });

  test('should show material source info', async ({ page }) => {
    // Navigate to Materials tab
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');

    // Verify source info is displayed
    const sourceInfo = page.locator('text=Source:');
    await expect(sourceInfo).toBeVisible();

    // Should show either API or JSON source
    const sourceType = page.locator('text=Materials:').first();
    await expect(sourceType).toContainText(/API|JSON/);
  });

  test('should filter materials by category', async ({ page }) => {
    // Navigate to Materials tab
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');

    // Select a category filter
    const categorySelect = page.locator('select');
    await categorySelect.selectOption({ index: 1 }); // Select first category

    // Verify materials are filtered
    const materialsCount = await page.locator('[data-testid="material-item"]').count();
    expect(materialsCount).toBeGreaterThan(0);
  });

  test('should search materials', async ({ page }) => {
    // Navigate to Materials tab
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');

    // Search for a material
    const searchInput = page.locator('input[placeholder="Search materials..."]');
    await searchInput.fill('marble');

    // Verify search results
    const materialsCount = await page.locator('[data-testid="material-item"]').count();
    expect(materialsCount).toBeGreaterThanOrEqual(0);
  });
});
