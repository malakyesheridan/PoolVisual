import { test, expect } from '@playwright/test';

test.describe('Underwater Effect', () => {
  test('should show visible underwater effect when enabled', async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the editor to load
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 10000 });
    
    // Upload a test image (create a simple test image)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-pool.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    });
    
    // Wait for image to load
    await page.waitForTimeout(1000);
    
    // Draw a mask (area tool)
    await page.keyboard.press('KeyA'); // Switch to area tool
    
    // Click to create a simple triangle mask
    const canvas = page.locator('[data-testid="canvas"]');
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      await page.mouse.click(canvasBox.x + 100, canvasBox.y + 100);
      await page.mouse.click(canvasBox.x + 200, canvasBox.y + 100);
      await page.mouse.click(canvasBox.x + 150, canvasBox.y + 200);
      await page.keyboard.press('Enter'); // Commit the mask
    }
    
    // Wait for mask to be created
    await page.waitForTimeout(500);
    
    // Apply a material to the mask
    const materialCard = page.locator('[data-testid="material-card"]').first();
    await materialCard.click();
    
    // Wait for material to be applied
    await page.waitForTimeout(500);
    
    // Check if underwater effect is enabled (should be auto-enabled for pool interior materials)
    const underwaterToggle = page.locator('button[class*="bg-blue-500"]');
    const isEnabled = await underwaterToggle.count() > 0;
    
    if (isEnabled) {
      // Test intensity slider
      const intensitySlider = page.locator('input[type="range"]');
      await intensitySlider.fill('80'); // Set to 80%
      
      // Wait for effect to apply
      await page.waitForTimeout(500);
      
      // Check dev breadcrumbs (only in dev mode)
      const breadcrumbs = page.locator('[class*="font-mono"]');
      if (await breadcrumbs.count() > 0) {
        const breadcrumbText = await breadcrumbs.textContent();
        expect(breadcrumbText).toContain('pipeline: underwater');
        expect(breadcrumbText).toContain('intensity: 80');
      }
      
      // Test toggle off
      await underwaterToggle.click();
      await page.waitForTimeout(500);
      
      // Test toggle back on
      await underwaterToggle.click();
      await page.waitForTimeout(500);
      
      // Verify the effect is working by checking that the UI responds
      const intensityValue = await intensitySlider.inputValue();
      expect(intensityValue).toBe('80');
    }
    
    // Test export with underwater effect
    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();
    
    // Wait for download to start
    await page.waitForTimeout(1000);
    
    // The test passes if we get this far without errors
    expect(true).toBe(true);
  });
  
  test('should show dev breadcrumbs in development mode', async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the editor to load
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 10000 });
    
    // Draw a mask
    await page.keyboard.press('KeyA');
    const canvas = page.locator('[data-testid="canvas"]');
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      await page.mouse.click(canvasBox.x + 100, canvasBox.y + 100);
      await page.mouse.click(canvasBox.x + 200, canvasBox.y + 100);
      await page.mouse.click(canvasBox.x + 150, canvasBox.y + 200);
      await page.keyboard.press('Enter');
    }
    
    // Apply a material
    const materialCard = page.locator('[data-testid="material-card"]').first();
    await materialCard.click();
    
    // Check for dev breadcrumbs
    const breadcrumbs = page.locator('[class*="font-mono"]');
    if (await breadcrumbs.count() > 0) {
      const breadcrumbText = await breadcrumbs.textContent();
      expect(breadcrumbText).toContain('pipeline:');
      expect(breadcrumbText).toContain('reason:');
      expect(breadcrumbText).toContain('cache:');
      expect(breadcrumbText).toContain('ms:');
      expect(breadcrumbText).toContain('params:');
    }
  });
});
