/**
 * Eraser Tool Controller
 * Handles mask deletion and point removal
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class EraserController implements ToolController {
  name = 'eraser' as const;

  constructor(private store: any) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, selectedMaskId } = this.store;
    
    // Only handle if eraser tool is active and not in calibration
    if (editorState.activeTool !== 'eraser' || editorState.calState !== 'idle') {
      return false;
    }

    // Erase from selected mask if available
    if (selectedMaskId) {
      this.store.eraseFromSelected([pt], editorState.brushSize || 10);
      return true;
    }
    
    return false;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState, selectedMaskId } = this.store;
    
    // Only handle if eraser tool is active and not in calibration
    if (editorState.activeTool !== 'eraser' || editorState.calState !== 'idle') {
      return false;
    }

    // Continue erasing if mouse is down
    if (selectedMaskId && ('buttons' in e.evt ? e.evt.buttons === 1 : true)) {
      this.store.eraseFromSelected([pt], editorState.brushSize || 10);
      return true;
    }
    
    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if eraser tool is active
    if (editorState.activeTool !== 'eraser' || editorState.calState !== 'idle') {
      return false;
    }

    // Stop erasing on pointer up
    return true;
  }

  onCancel(): void {
    // Eraser doesn't have ongoing state to cancel
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { editorState } = this.store;
    
    if (editorState.activeTool !== 'eraser' || editorState.calState !== 'idle') {
      return false;
    }

    // Eraser can handle brush size changes via keyboard
    return false;
  }

  getCursor(): string {
    return 'crosshair';
  }
}