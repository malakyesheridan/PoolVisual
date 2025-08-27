/**
 * Area Tool Controller
 * Handles freehand polygon drawing with smoothing
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class AreaController implements ToolController {
  name = 'area' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if area tool is active and not in calibration
    if (editorState.activeTool !== 'area' || editorState.calState !== 'idle') {
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
    
    // Only handle if area tool is active and drawing
    if (editorState.activeTool !== 'area' || 
        editorState.calState !== 'idle' || 
        !currentDrawing) {
      return false;
    }

    // Add point to current drawing
    this.store.addPoint(pt);
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if area tool is active
    if (editorState.activeTool !== 'area' || editorState.calState !== 'idle') {
      return false;
    }

    // Area tool continues drawing until explicit finish
    return true;
  }

  onCancel(): void {
    if (this.store.currentDrawing) {
      this.store.cancelDrawing();
    }
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { editorState, currentDrawing } = this.store;
    
    if (editorState.activeTool !== 'area' || editorState.calState !== 'idle') {
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
          this.store.finishDrawing('area');
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