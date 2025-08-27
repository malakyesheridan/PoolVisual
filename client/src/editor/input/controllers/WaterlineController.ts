/**
 * Waterline Tool Controller
 * Handles waterline band drawing with height calculations
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class WaterlineController implements ToolController {
  name = 'waterline' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState, transient } = this.store;
    
    // Only handle if waterline tool is active and not in calibration
    if (activeTool !== 'waterline' || calState !== 'idle') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!transient) {
      this.store.startPath('waterline', pt);
      console.log('[WaterlineController] Started new waterline path', { pt });
    } else {
      this.store.appendPoint(pt);
      console.log('[WaterlineController] Added point to waterline path', { pt, totalPoints: transient.points.length + 1 });
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState, transient } = this.store;
    
    // Only handle if waterline tool is active and drawing
    if (activeTool !== 'waterline' || calState !== 'idle' || !transient) {
      return false;
    }

    // Show live preview for waterline band
    this.store.updatePathPreview(pt);
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState } = this.store;
    
    // Only handle if waterline tool is active
    if (activeTool !== 'waterline' || calState !== 'idle') {
      return false;
    }

    // Waterline tool continues until explicit finish
    return true;
  }

  onCancel(): void {
    this.store.cancelPath();
    console.log('[WaterlineController] Cancelled waterline drawing');
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { activeTool, calState, transient } = this.store;
    
    if (activeTool !== 'waterline' || calState !== 'idle') {
      return false;
    }

    switch (code) {
      case 'Escape':
        if (transient) {
          this.store.cancelPath();
          console.log('[WaterlineController] Cancelled waterline path via Escape');
          return true;
        }
        break;
        
      case 'Enter':
        if (transient && transient.points.length >= 2) {
          this.store.commitPath();
          console.log('[WaterlineController] Committed waterline path via Enter', { points: transient.points.length });
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