/**
 * Eraser Tool Controller
 * Handles mask deletion and point removal
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class EraserController implements ToolController {
  name = 'eraser' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState, selectedMaskId, brushSize } = this.store;
    
    // Only handle if eraser tool is active and not in calibration
    if (activeTool !== 'eraser' || calState !== 'idle') {
      return false;
    }

    // Erase from selected mask if available
    if (selectedMaskId) {
      // For now, just remove the selected mask entirely
      this.store.deleteMask(selectedMaskId);
      console.log('[EraserController] Deleted mask', { selectedMaskId });
      return true;
    }
    
    return false;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState } = this.store;
    
    // Only handle if eraser tool is active and not in calibration
    if (activeTool !== 'eraser' || calState !== 'idle') {
      return false;
    }

    // Eraser tool doesn't have drag behavior for now
    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { activeTool, calState } = this.store;
    
    // Only handle if eraser tool is active
    if (activeTool !== 'eraser' || calState !== 'idle') {
      return false;
    }

    // Stop erasing on pointer up
    return true;
  }

  onCancel(): void {
    // Eraser doesn't have ongoing state to cancel
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { activeTool, calState } = this.store;
    
    if (activeTool !== 'eraser' || calState !== 'idle') {
      return false;
    }

    // Eraser can handle brush size changes via keyboard
    return false;
  }

  getCursor(): string {
    return 'crosshair';
  }
}