// E2E Tests for Pool Templates
import { test, expect } from '@playwright/test';

test.describe('Pool Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should load templates and apply first template (Replace)', async ({ page }) => {
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Wait for templates to load
    await page.waitForSelector('text=Standard Rectangular Pool');

    // Apply first template with Replace mode
    await page.click('button:has-text("Apply")');
    
    // Confirm Replace in dialog
    await page.click('text=OK'); // Assuming dialog has OK button for Replace

    // Verify template was applied by checking for mask elements
    await page.waitForSelector('[data-testid="mask"]', { timeout: 5000 });
    
    // Verify undo works
    await page.keyboard.press('Control+z');
    
    // Check that mask is removed
    await expect(page.locator('[data-testid="mask"]')).toHaveCount(0);
  });

  test('should apply second template (Merge) and preserve existing content', async ({ page }) => {
    // First, create some existing content
    await page.click('button:has-text("Materials")');
    await page.waitForSelector('text=Materials');
    
    // Select a material and draw a mask
    await page.click('[data-testid="material-card"]:first-child');
    await page.keyboard.press('KeyA'); // Switch to area tool
    
    // Draw a simple mask
    await page.click('canvas', { position: { x: 100, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 100 } });
    await page.click('canvas', { position: { x: 200, y: 200 } });
    await page.click('canvas', { position: { x: 100, y: 200 } });
    await page.keyboard.press('Enter');
    
    // Verify mask exists
    await page.waitForSelector('[data-testid="mask"]');
    const initialMaskCount = await page.locator('[data-testid="mask"]').count();

    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Apply second template with Merge mode
    const applyButtons = page.locator('button:has-text("Apply")');
    await applyButtons.nth(1).click();
    
    // Cancel Replace dialog to choose Merge
    await page.click('text=Cancel'); // Assuming dialog has Cancel for Merge

    // Verify both original and template content exist
    await page.waitForSelector('[data-testid="mask"]');
    const finalMaskCount = await page.locator('[data-testid="mask"]').count();
    
    expect(finalMaskCount).toBeGreaterThan(initialMaskCount);

    // Test undo reverts to pre-merge state
    await page.keyboard.press('Control+z');
    const undoMaskCount = await page.locator('[data-testid="mask"]').count();
    expect(undoMaskCount).toBe(initialMaskCount);
  });

  test('should show template preview and info', async ({ page }) => {
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Test Preview button
    await page.click('button:has-text("Preview")');
    
    // Should show alert with template info
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Preview');
      dialog.accept();
    });

    // Test Info button
    await page.click('button:has-text("Info")');
    
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Template');
      expect(dialog.message()).toContain('masks');
      expect(dialog.message()).toContain('assets');
      dialog.accept();
    });
  });

  test('should filter templates by category', async ({ page }) => {
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Wait for templates to load
    await page.waitForSelector('text=Standard Rectangular Pool');

    // Filter by rectangular category
    await page.selectOption('select', 'rectangular');
    
    // Should only show rectangular templates
    await expect(page.locator('text=Standard Rectangular Pool')).toBeVisible();
    await expect(page.locator('text=Natural Freeform Pool')).not.toBeVisible();
  });

  test('should search templates by name', async ({ page }) => {
    // Navigate to Pools tab
    await page.click('button:has-text("Pools")');
    await page.waitForSelector('text=Pool Templates');

    // Search for "luxury"
    await page.fill('input[placeholder="Search templates..."]', 'luxury');
    
    // Should only show luxury spa template
    await expect(page.locator('text=Luxury Spa Pool')).toBeVisible();
    await expect(page.locator('text=Standard Rectangular Pool')).not.toBeVisible();
  });
});
