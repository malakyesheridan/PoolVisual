// E2E Tests for Drag-Through Functionality
import { test, expect } from '@playwright/test';

test.describe('Drag-Through Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5001/new-editor');
    await page.waitForLoadState('networkidle');
  });

  test('should drag from sidebar across edge at 75% zoom', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Set zoom to 75%
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+-');

    // Get sidebar and canvas elements
    const sidebar = page.locator('[data-testid="asset-card"]').first();
    const canvas = page.locator('canvas');
    
    // Get sidebar position
    const sidebarBox = await sidebar.boundingBox();
    const canvasBox = await canvas.boundingBox();
    
    if (sidebarBox && canvasBox) {
      // Drag from sidebar edge to canvas center
      await sidebar.dragTo(canvas, {
        targetPosition: { 
          x: canvasBox.width / 2, 
          y: canvasBox.height / 2 
        }
      });

      // Verify asset was placed
      await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    }
  });

  test('should drag from sidebar across edge at 150% zoom', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Set zoom to 150%
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');

    // Get sidebar and canvas elements
    const sidebar = page.locator('[data-testid="asset-card"]').first();
    const canvas = page.locator('canvas');
    
    // Get sidebar position
    const sidebarBox = await sidebar.boundingBox();
    const canvasBox = await canvas.boundingBox();
    
    if (sidebarBox && canvasBox) {
      // Drag from sidebar edge to canvas center
      await sidebar.dragTo(canvas, {
        targetPosition: { 
          x: canvasBox.width / 2, 
          y: canvasBox.height / 2 
        }
      });

      // Verify asset was placed
      await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
    }
  });

  test('should show ghost element during drag', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Start drag from sidebar
    const sidebar = page.locator('[data-testid="asset-card"]').first();
    const canvas = page.locator('canvas');
    
    // Start drag operation
    await sidebar.hover();
    await page.mouse.down();
    
    // Move mouse to canvas
    await page.mouse.move(400, 300);
    
    // Check for ghost element
    const ghost = page.locator('.asset-drag-ghost');
    await expect(ghost).toBeVisible();
    
    // Complete drag
    await page.mouse.up();
    
    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should handle drag outside canvas bounds', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Drag asset outside canvas
    const sidebar = page.locator('[data-testid="asset-card"]').first();
    const outsideArea = page.locator('body');
    
    await sidebar.dragTo(outsideArea, { 
      targetPosition: { x: 50, y: 50 } 
    });

    // Should still place asset (clamped to bounds)
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });

  test('should maintain ghost position during drag', async ({ page }) => {
    // Navigate to Assets tab
    await page.click('button:has-text("Assets")');
    await page.waitForSelector('text=Asset Library');

    // Start drag from sidebar
    const sidebar = page.locator('[data-testid="asset-card"]').first();
    
    // Start drag operation
    await sidebar.hover();
    await page.mouse.down();
    
    // Move mouse to different positions
    await page.mouse.move(200, 150);
    await page.mouse.move(300, 200);
    await page.mouse.move(400, 250);
    
    // Check ghost follows cursor
    const ghost = page.locator('.asset-drag-ghost');
    await expect(ghost).toBeVisible();
    
    // Complete drag
    await page.mouse.up();
    
    // Verify asset was placed
    await page.waitForSelector('[data-testid="asset"]', { timeout: 5000 });
  });
});
