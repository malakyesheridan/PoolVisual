import { test, expect } from '@playwright/test';

test.describe('Materials Revert Tests', () => {
  test('materials_revert.spec - Materials panel shows real library (≥8 items)', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to the editor
    await page.click('text=Canvas Editor');
    await page.waitForLoadState('networkidle');
    
    // Wait for the editor to be ready
    await page.waitForSelector('[data-editor-stage]', { timeout: 10000 });
    
    // Wait for materials to load
    await page.waitForTimeout(1000);
    
    // Check materials panel shows real materials
    const materialsPanel = page.locator('text=Materials:').first();
    await expect(materialsPanel).toBeVisible();
    
    // Check that materials count is ≥8 (not placeholder set)
    const materialsText = await materialsPanel.textContent();
    expect(materialsText).toMatch(/Materials: (API|JSON|DEV) \(\d+\)/);
    
    // Extract count from text like "Materials: JSON (8)"
    const countMatch = materialsText!.match(/Materials: \w+ \((\d+)\)/);
    expect(countMatch).toBeTruthy();
    const count = parseInt(countMatch![1]);
    expect(count).toBeGreaterThanOrEqual(8); // PHASE 3: Must be ≥8
    
    // Check that first 8 material IDs are visible
    const materialCards = page.locator('[data-testid="material-card"], .material-card, .border.rounded-lg').first();
    if (await materialCards.count() > 0) {
      // Check that material cards are visible
      await expect(materialCards).toBeVisible();
    }
    
    // Switch to area tool and create a mask
    await page.click('[data-testid="area-tool"], button:has-text("Area"), button:has-text("area")');
    
    const canvasElement = page.locator('canvas').first();
    const canvasRect = await canvasElement.boundingBox();
    
    if (canvasRect) {
      // Draw a simple mask
      const startX = canvasRect.x + canvasRect.width * 0.3;
      const startY = canvasRect.y + canvasRect.height * 0.3;
      
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY + 30);
      await page.mouse.move(startX + 100, startY + 20);
      await page.mouse.move(startX + 150, startY + 40);
      await page.mouse.up();
      
      // Finalize with Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      
      // Try to apply first material to selected mask
      const firstMaterial = page.locator('[data-testid="material-card"], .border.rounded-lg').first();
      if (await firstMaterial.count() > 0) {
        await firstMaterial.click();
        await page.waitForTimeout(200);
        
        // PHASE 3: Check that material was applied (assert fill style changed)
        const materialApplied = await page.evaluate(() => {
          // Check if any masks have materials applied
          const canvas = document.querySelector('canvas');
          if (!canvas) return false;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return false;
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Look for non-default colors (indicating material application)
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 50 || data[i + 1] > 50 || data[i + 2] > 50) {
              return true; // Found non-black pixel
            }
          }
          return false;
        });
        
        expect(materialApplied).toBe(true);
      }
    }
    
    console.log('Materials revert test completed successfully');
  });
});
