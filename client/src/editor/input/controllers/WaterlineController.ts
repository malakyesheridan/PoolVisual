/**
 * Waterline Tool Controller
 * Handles waterline band drawing with height calculations
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class WaterlineController implements ToolController {
  name = 'waterline' as const;

  constructor(private store: any) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if waterline tool is active and not in calibration
    if (editorState.activeTool !== 'waterline' || editorState.calState !== 'idle') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!this.store.currentDrawing) {
      this.store.startDrawing(pt);
    } else {
      this.store.addPoint(pt);
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, currentDrawing } = this.store;
    
    // Only handle if waterline tool is active and drawing
    if (editorState.activeTool !== 'waterline' || 
        editorState.calState !== 'idle' || 
        !currentDrawing) {
      return false;
    }

    // Show preview for waterline band
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if waterline tool is active
    if (editorState.activeTool !== 'waterline' || editorState.calState !== 'idle') {
      return false;
    }

    // Waterline tool continues until explicit finish
    return true;
  }

  onCancel(): void {
    if (this.store.currentDrawing) {
      this.store.cancelDrawing();
    }
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { editorState, currentDrawing } = this.store;
    
    if (editorState.activeTool !== 'waterline' || editorState.calState !== 'idle') {
      return false;
    }

    switch (code) {
      case 'Escape':
        if (currentDrawing) {
          this.onCancel();
          return true;
        }
        break;
        
      case 'Enter':
        if (currentDrawing) {
          this.store.finishDrawing('waterline_band');
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