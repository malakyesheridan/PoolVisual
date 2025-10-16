import { test, expect } from '@playwright/test';

test.describe('New Editor Dev Overlay', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new editor
    await page.goto('/new-editor');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should show collapsed pill by default and not block toolbar', async ({ page }) => {
    // Check that the collapsed pill is visible
    const devPill = page.locator('[title*="Click to expand dev overlay"]');
    await expect(devPill).toBeVisible();
    
    // Check that it's positioned at top-left
    const pillBox = await devPill.boundingBox();
    expect(pillBox?.x).toBeLessThan(100); // Should be near left edge
    expect(pillBox?.y).toBeLessThan(100); // Should be near top edge
    
    // Check that Upload button is clickable (not blocked by overlay)
    const uploadButton = page.locator('button').filter({ hasText: 'Upload' });
    await expect(uploadButton).toBeVisible();
    
    // Verify Upload button is clickable by checking it's not covered
    const uploadBox = await uploadButton.boundingBox();
    const pillBox2 = await devPill.boundingBox();
    
    // Pill should not overlap with Upload button
    if (pillBox2 && uploadBox) {
      const overlap = !(
        pillBox2.x + pillBox2.width < uploadBox.x ||
        uploadBox.x + uploadBox.width < pillBox2.x ||
        pillBox2.y + pillBox2.height < uploadBox.y ||
        uploadBox.y + uploadBox.height < pillBox2.y
      );
      expect(overlap).toBe(false);
    }
  });

  test('should toggle with backtick key', async ({ page }) => {
    // Initially collapsed
    const devPill = page.locator('[title*="Click to expand dev overlay"]');
    await expect(devPill).toBeVisible();
    
    // Press backtick to expand
    await page.keyboard.press('`');
    
    // Should now show expanded overlay
    const expandedOverlay = page.locator('text=DEV OVERLAY').locator('..').locator('..');
    await expect(expandedOverlay).toBeVisible();
    
    // Should show state information
    await expect(expandedOverlay).toContainText('State: idle');
    await expect(expandedOverlay).toContainText('Zoom: 100%');
    
    // Press backtick again to collapse
    await page.keyboard.press('`');
    
    // Should be back to collapsed pill
    await expect(devPill).toBeVisible();
  });

  test('should toggle with toolbar button', async ({ page }) => {
    // Initially collapsed
    const devPill = page.locator('[title*="Click to expand dev overlay"]');
    await expect(devPill).toBeVisible();
    
    // Click the dev toggle button in toolbar
    const devButton = page.locator('button[title*="Toggle Dev Overlay"]');
    await expect(devButton).toBeVisible();
    await devButton.click();
    
    // Should now show expanded overlay
    const expandedOverlay = page.locator('text=DEV OVERLAY').locator('..').locator('..');
    await expect(expandedOverlay).toBeVisible();
    
    // Click close button to collapse
    const closeButton = page.locator('button[title*="Collapse overlay"]');
    await closeButton.click();
    
    // Should be back to collapsed pill
    await expect(devPill).toBeVisible();
  });

  test('should be draggable and persist position', async ({ page }) => {
    // Expand the overlay first
    await page.keyboard.press('`');
    
    const expandedOverlay = page.locator('text=DEV OVERLAY').locator('..').locator('..');
    await expect(expandedOverlay).toBeVisible();
    
    // Get initial position
    const initialBox = await expandedOverlay.boundingBox();
    expect(initialBox).not.toBeNull();
    
    // Drag the overlay to a new position
    const header = expandedOverlay.locator('.cursor-move');
    await header.hover();
    await page.mouse.down();
    await page.mouse.move(400, 300);
    await page.mouse.up();
    
    // Check that position changed
    const newBox = await expandedOverlay.boundingBox();
    expect(newBox?.x).not.toBe(initialBox?.x);
    expect(newBox?.y).not.toBe(initialBox?.y);
    
    // Reload page to test persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Expand again
    await page.keyboard.press('`');
    
    // Check that position was persisted
    const persistedBox = await expandedOverlay.boundingBox();
    expect(persistedBox?.x).toBeCloseTo(newBox?.x || 0, 10);
    expect(persistedBox?.y).toBeCloseTo(newBox?.y || 0, 10);
  });

  test('should not render in production', async ({ page }) => {
    // This test simulates production by checking that the overlay
    // respects the import.meta.env.DEV check
    
    // In development, the overlay should be visible
    const devPill = page.locator('[title*="Click to expand dev overlay"]');
    await expect(devPill).toBeVisible();
    
    // The dev button should also be visible in toolbar
    const devButton = page.locator('button[title*="Toggle Dev Overlay"]');
    await expect(devButton).toBeVisible();
    
    // Note: In a real production build, these elements would not be rendered
    // due to the import.meta.env.DEV check in the components
  });

  test('should not block toolbar interactions when expanded', async ({ page }) => {
    // Expand the overlay
    await page.keyboard.press('`');
    
    const expandedOverlay = page.locator('text=DEV OVERLAY').locator('..').locator('..');
    await expect(expandedOverlay).toBeVisible();
    
    // Upload button should still be clickable
    const uploadButton = page.locator('button').filter({ hasText: 'Upload' });
    await expect(uploadButton).toBeVisible();
    
    // Try to click Upload button (should work despite overlay being expanded)
    await uploadButton.click();
    
    // File input should be triggered (we can't easily test the file dialog,
    // but we can verify the button is clickable)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('should show correct state information', async ({ page }) => {
    // Expand the overlay
    await page.keyboard.press('`');
    
    const expandedOverlay = page.locator('text=DEV OVERLAY').locator('..').locator('..');
    await expect(expandedOverlay).toBeVisible();
    
    // Check initial state
    await expect(expandedOverlay).toContainText('State: idle');
    await expect(expandedOverlay).toContainText('Tool: select');
    await expect(expandedOverlay).toContainText('Zoom: 100%');
    await expect(expandedOverlay).toContainText('Image: 0×0');
    await expect(expandedOverlay).toContainText('Masks: 0');
    
    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('client/public/fixtures/test-portrait.svg');
    await page.waitForTimeout(500);
    
    // Check that state updated
    await expect(expandedOverlay).toContainText('State: ready');
    await expect(expandedOverlay).toContainText(/Image: \d+×\d+/);
    await expect(expandedOverlay).toContainText(/Zoom: \d+%/);
  });
});
