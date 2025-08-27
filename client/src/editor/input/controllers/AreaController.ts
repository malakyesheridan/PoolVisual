/**
 * Area Tool Controller
 * Handles freehand polygon drawing with smoothing
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class AreaController implements ToolController {
  name = 'area' as const;

  constructor(private store: any) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, transient } = this.store;
    
    // F. CONTROLLER CONTRACTS - Only handle if area tool is active
    if (editorState?.activeTool !== 'area') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!transient) {
      this.store.startPath('area', pt);
    } else {
      this.store.appendPoint(pt);
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    // Area tool doesn't use move for drawing - only click-to-add points
    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if area tool is active
    if (editorState?.activeTool !== 'area') {
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
    const { editorState, transient } = this.store;
    
    if (editorState?.activeTool !== 'area') {
      return false;
    }

    switch (code) {
      case 'Escape':
        if (transient) {
          this.store.cancelPath();
          return true;
        }
        break;
        
      case 'Enter':
        if (transient) {
          this.store.commitPath();
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