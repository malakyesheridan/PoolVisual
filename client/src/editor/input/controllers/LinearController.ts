/**
 * Linear Tool Controller
 * Handles polyline drawing for perimeter measurements
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class LinearController implements ToolController {
  name = 'linear' as const;

  constructor(private store: any) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, transient } = this.store;
    
    // F. CONTROLLER CONTRACTS - Only handle if linear tool is active
    if (editorState?.activeTool !== 'linear') {
      return false;
    }

    // Start new drawing or add point to existing
    if (!transient) {
      this.store.startPath('linear', pt);
    } else {
      this.store.appendPoint(pt);
    }
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, currentDrawing } = this.store;
    
    // Only handle if linear tool is active and drawing
    if (editorState?.activeTool !== 'linear' || !currentDrawing) {
      return false;
    }

    // For linear tool, show preview or add points
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if linear tool is active
    if (editorState?.activeTool !== 'linear') {
      return false;
    }

    // Linear tool continues until explicit finish
    return true;
  }

  onCancel(): void {
    if (this.store.currentDrawing) {
      this.store.cancelDrawing();
    }
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { editorState, transient } = this.store;
    
    if (editorState?.activeTool !== 'linear') {
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