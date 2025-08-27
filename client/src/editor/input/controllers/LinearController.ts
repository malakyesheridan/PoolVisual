/**
 * Linear Tool Controller
 * Handles polyline drawing for perimeter measurements
 * Fixed to work with the new bulletproof store structure
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class LinearController implements ToolController {
  name = 'linear' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, transient } = this.store;
    
    // Only handle if linear tool is active
    if (activeTool !== 'linear') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!transient) {
      this.store.startPath('linear', pt);
      console.log('[LinearController] Started new linear path', { pt });
    } else {
      this.store.appendPoint(pt);
      console.log('[LinearController] Added point to linear path', { pt, totalPoints: transient.points.length + 1 });
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, transient } = this.store;
    
    // Only handle if linear tool is active and drawing
    if (activeTool !== 'linear' || !transient) {
      return false;
    }

    // Show live preview line from last point to cursor
    this.store.updatePathPreview(pt);
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool } = this.store;
    
    // Only handle if linear tool is active
    if (activeTool !== 'linear') {
      return false;
    }

    // Linear tool continues until explicit finish
    return true;
  }

  onCancel(): void {
    this.store.cancelPath();
    console.log('[LinearController] Cancelled linear drawing');
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { activeTool, transient } = this.store;
    
    if (activeTool !== 'linear') {
      return false;
    }

    switch (code) {
      case 'Escape':
        if (transient) {
          this.store.cancelPath();
          console.log('[LinearController] Cancelled linear path via Escape');
          return true;
        }
        break;
        
      case 'Enter':
        if (transient && transient.points.length >= 2) {
          this.store.commitPath();
          console.log('[LinearController] Committed linear path via Enter', { points: transient.points.length });
          return true;
        }
        break;
    }
    
    return false;
  }

  getCursor(): string {
    return 'crosshair';
  }
}