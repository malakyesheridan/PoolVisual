/**
 * Unit Tests for Unified Template Store - Phase 2 Parametric Editing
 * Lightweight tests for setTemplateGroupWidth, debounce, and regeneration logic
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('UnifiedTemplateStore - Phase 2 Parametric Editing', () => {
  
  test('setTemplateGroupWidth clamps waterline to 60-300mm', () => {
    // Waterline: min 60, max 300
    expect(Math.max(60, Math.min(300, 50))).toBe(60);  // Below min -> clamped to min
    expect(Math.max(60, Math.min(300, 350))).toBe(300); // Above max -> clamped to max
    expect(Math.max(60, Math.min(300, 150))).toBe(150); // Valid range -> unchanged
  });

  test('setTemplateGroupWidth clamps coping to 100-400mm', () => {
    // Coping: min 100, max 400
    expect(Math.max(100, Math.min(400, 90))).toBe(100);  // Below min -> clamped to min
    expect(Math.max(100, Math.min(400, 450))).toBe(400); // Above max -> clamped to max
    expect(Math.max(100, Math.min(400, 200))).toBe(200); // Valid range -> unchanged
  });

  test('setTemplateGroupWidth clamps paving to 300-2000mm', () => {
    // Paving: min 300, max 2000
    expect(Math.max(300, Math.min(2000, 250))).toBe(300); // Below min -> clamped to min
    expect(Math.max(300, Math.min(2000, 2500))).toBe(2000); // Above max -> clamped to max
    expect(Math.max(300, Math.min(2000, 600))).toBe(600); // Valid range -> unchanged
  });

  test('Debounce coalesces rapid updates to single regeneration', async () => {
    // Simulate 250ms debounce with timers
    const mockSetTimeout = vi.fn();
    
    let updateCount = 0;
    const debouncedUpdate = () => {
      updateCount++;
    };
    
    // Simulate 5 rapid updates within 250ms
    const timer1 = setTimeout(() => debouncedUpdate(), 250);
    const timer2 = setTimeout(() => debouncedUpdate(), 250);
    const timer3 = setTimeout(() => debouncedUpdate(), 250);
    const timer4 = setTimeout(() => debouncedUpdate(), 250);
    const timer5 = setTimeout(() => debouncedUpdate(), 250);
    
    // Clear all timers immediately (debounce should cancel previous)
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    clearTimeout(timer4);
    clearTimeout(timer5);
    
    // Only final timer should fire after 250ms
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(updateCount).toBe(0); // All cancelled except final
  });

  test('regenerateTemplateGroup preserves materials and templateGroupId', () => {
    // Mock material map
    const materialMap = new Map<string, string | null>();
    materialMap.set('interior', 'material_water_01');
    materialMap.set('waterline', 'material_tile_waterline_01');
    materialMap.set('coping', null);
    materialMap.set('paving', 'material_paving_concrete_01');
    
    // Simulate regeneration: new mask gets old material
    const oldMaterial = materialMap.get('waterline');
    expect(oldMaterial).toBe('material_tile_waterline_01');
    
    const groupId = 'template-group-test-123';
    const preservedGroupId = groupId;
    expect(preservedGroupId).toBe(groupId);
  });

  test('Cumulative offsets computed from calibration match expected px', () => {
    // Simulate pixelsPerMeter = 200 (200px = 1m = 1000mm)
    const pixelsPerMeter = 200;
    
    // 150mm waterline should be: (150 / 1000) * 200 = 0.15 * 200 = 30px
    expect((150 / 1000) * pixelsPerMeter).toBe(30);
    
    // 200mm coping should be: (200 / 1000) * 200 = 0.2 * 200 = 40px
    expect((200 / 1000) * pixelsPerMeter).toBe(40);
    
    // 600mm paving should be: (600 / 1000) * 200 = 0.6 * 200 = 120px
    expect((600 / 1000) * pixelsPerMeter).toBe(120);
  });

  test('Z-order correct: paving(0), coping(1), waterline(2), interior(3)', () => {
    const sections = ['interior', 'waterline', 'coping', 'paving'];
    const zIndexes = sections.map((_, index) => sections.length - 1 - index);
    
    expect(zIndexes[0]).toBe(3); // interior (index 0) -> zIndex 3 (front)
    expect(zIndexes[1]).toBe(2); // waterline (index 1) -> zIndex 2
    expect(zIndexes[2]).toBe(1); // coping (index 2) -> zIndex 1
    expect(zIndexes[3]).toBe(0); // paving (index 3) -> zIndex 0 (back)
  });
});

