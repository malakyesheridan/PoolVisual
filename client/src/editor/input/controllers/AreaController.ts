/**
 * Area Tool Controller
 * Handles polygon drawing with click-to-add-points interaction
 * Fixed to work with the new bulletproof store structure
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class AreaController implements ToolController {
  name = 'area' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, transient } = this.store;
    
    // Only handle if area tool is active
    if (activeTool !== 'area') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!transient) {
      this.store.startPath('area', pt);
      console.log('[AreaController] Started new area path', { pt });
    } else {
      this.store.appendPoint(pt);
      console.log('[AreaController] Added point to area path', { pt, totalPoints: transient.points.length + 1 });
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    // Area tool uses click-to-add points, not drag drawing
    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool } = this.store;
    
    // Only handle if area tool is active
    if (activeTool !== 'area') {
      return false;
    }

    // Area tool continues drawing until explicit finish
    return true;
  }

  onCancel(): void {
    this.store.cancelPath();
    console.log('[AreaController] Cancelled area drawing');
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { activeTool, transient } = this.store;
    
    if (activeTool !== 'area') {
      return false;
    }

    switch (code) {
      case 'Escape':
        if (transient) {
          this.store.cancelPath();
          console.log('[AreaController] Cancelled area path via Escape');
          return true;
        }
        break;
        
      case 'Enter':
        if (transient && transient.points.length >= 3) {
          this.store.commitPath();
          console.log('[AreaController] Committed area path via Enter', { points: transient.points.length });
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