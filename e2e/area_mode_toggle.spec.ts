import { test, expect } from '@playwright/test';

test.describe('Area Mode Toggle Tests', () => {
  test('area_mode_toggle.spec - V1/V2 mode switching', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Verify we start in V1 mode (default)
    let devChip = page.locator('text=MaskMode: AreaV1');
    await expect(devChip).toBeVisible();
    
    // Test toggle to V2
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(100);
    
    // Verify we're now in V2 mode
    devChip = page.locator('text=MaskMode: AreaV2');
    await expect(devChip).toBeVisible();
    
    // Test toggle back to V1
    await page.keyboard.press('Control+Shift+M');
    await page.waitForTimeout(100);
    
    // Verify we're back in V1 mode
    devChip = page.locator('text=MaskMode: AreaV1');
    await expect(devChip).toBeVisible();
    
    // Test that V1 is the default after page reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    devChip = page.locator('text=MaskMode: AreaV1');
    await expect(devChip).toBeVisible();
    
    console.log('Area mode toggle test completed successfully');
  });
});
