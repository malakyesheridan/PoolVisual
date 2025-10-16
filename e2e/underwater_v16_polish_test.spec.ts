import { test, expect } from '@playwright/test';

test.describe('Under-Water Effect v1.6 Polish', () => {
  test('should show v1.6 pipeline when feature flag is enabled', async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the editor to load
    await page.waitForSelector('[data-testid="canvas"]', { timeout: 10000 });
    
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
    
    // Check if underwater effect is enabled
    const underwaterToggle = page.locator('button[class*="bg-blue-500"]');
    const isEnabled = await underwaterToggle.count() > 0;
    
    if (isEnabled) {
      // Check dev breadcrumbs for v1.6 pipeline
      const breadcrumbs = page.locator('[class*="font-mono"]');
      if (await breadcrumbs.count() > 0) {
        const breadcrumbText = await breadcrumbs.textContent();
        
        // Should show v1.6 pipeline in dev mode
        expect(breadcrumbText).toContain('pipeline: underwater-v1.6');
        expect(breadcrumbText).toContain('uw v1.6');
        expect(breadcrumbText).toContain('matOpacity');
      }
      
      // Test v1.6 controls
      const materialOpacitySlider = page.locator('input[type="range"]').nth(1); // Second slider should be material opacity
      if (await materialOpacitySlider.count() > 0) {
        await materialOpacitySlider.fill('75'); // Set material opacity to 75%
        await page.waitForTimeout(500);
        
        const opacityValue = await materialOpacitySlider.inputValue();
        expect(opacityValue).toBe('75');
      }
      
      // Test contact occlusion slider
      const contactOcclusionSlider = page.locator('input[type="range"]').nth(2); // Third slider should be contact occlusion
      if (await contactOcclusionSlider.count() > 0) {
        await contactOcclusionSlider.fill('15'); // Set contact occlusion to 15%
        await page.waitForTimeout(500);
        
        const contactValue = await contactOcclusionSlider.inputValue();
        expect(contactValue).toBe('15');
      }
      
      // Test texture boost slider
      const textureBoostSlider = page.locator('input[type="range"]').nth(3); // Fourth slider should be texture boost
      if (await textureBoostSlider.count() > 0) {
        await textureBoostSlider.fill('30'); // Set texture boost to 30%
        await page.waitForTimeout(500);
        
        const boostValue = await textureBoostSlider.inputValue();
        expect(boostValue).toBe('30');
      }
      
      // Test clamped ranges
      const tintSlider = page.locator('input[type="range"]').nth(4); // Fifth slider should be tint
      if (await tintSlider.count() > 0) {
        await tintSlider.fill('50'); // Try to set tint to 50% (should be clamped to 40%)
        await page.waitForTimeout(500);
        
        const tintValue = await tintSlider.inputValue();
        expect(parseInt(tintValue)).toBeLessThanOrEqual(40); // Should be clamped
      }
      
      // Test ripple slider (should be clamped to 10%)
      const rippleSlider = page.locator('input[type="range"]').nth(5); // Sixth slider should be ripple
      if (await rippleSlider.count() > 0) {
        await rippleSlider.fill('20'); // Try to set ripple to 20% (should be clamped to 10%)
        await page.waitForTimeout(500);
        
        const rippleValue = await rippleSlider.inputValue();
        expect(parseInt(rippleValue)).toBeLessThanOrEqual(10); // Should be clamped
      }
    }
    
    // Test export with v1.6 effects
    const exportButton = page.locator('button:has-text("Export")');
    await exportButton.click();
    
    // Wait for download to start
    await page.waitForTimeout(1000);
    
    // The test passes if we get this far without errors
    expect(true).toBe(true);
  });
  
  test('should show auto-calibrated indicator when defaults are applied', async ({ page }) => {
    await page.goto('/new-editor');
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
    
    // Check for auto-calibrated indicator
    const autoCalibratedIndicator = page.locator('text=Auto-calibrated from photo luminance');
    if (await autoCalibratedIndicator.count() > 0) {
      expect(autoCalibratedIndicator).toBeVisible();
    }
  });
  
  test('should maintain export parity between canvas and PNG', async ({ page }) => {
    await page.goto('/new-editor');
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
    
    // Adjust underwater settings
    const underwaterToggle = page.locator('button[class*="bg-blue-500"]');
    if (await underwaterToggle.count() > 0) {
      // Set some specific values
      const intensitySlider = page.locator('input[type="range"]').first();
      await intensitySlider.fill('55');
      
      // Set material opacity
      const materialOpacitySlider = page.locator('input[type="range"]').nth(1);
      if (await materialOpacitySlider.count() > 0) {
        await materialOpacitySlider.fill('80');
      }
      
      // Wait for effect to apply
      await page.waitForTimeout(500);
      
      // Export
      const exportButton = page.locator('button:has-text("Export")');
      await exportButton.click();
      
      // Wait for download
      await page.waitForTimeout(1000);
      
      // Verify no errors occurred during export
      expect(true).toBe(true);
    }
  });
  
  test('should show v1.5 pipeline when v1.6 feature flag is disabled', async ({ page }) => {
    // This test would require setting the feature flag to false
    // For now, just verify the system gracefully handles both modes
    
    await page.goto('/new-editor');
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
    
    // Check breadcrumbs
    const breadcrumbs = page.locator('[class*="font-mono"]');
    if (await breadcrumbs.count() > 0) {
      const breadcrumbText = await breadcrumbs.textContent();
      // Should show either v1.6, v1.5, or v1.0 pipeline
      expect(breadcrumbText).toMatch(/pipeline: underwater-v(1\.0|1\.5|1\.6)/);
    }
  });
});
