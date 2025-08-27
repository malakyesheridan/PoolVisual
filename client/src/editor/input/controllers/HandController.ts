/**
 * Hand Tool Controller
 * Handles pan navigation (Stage dragging is handled by the router)
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class HandController implements ToolController {
  name = 'hand' as const;
  
  private isPanning = false;
  private lastPointerPosition: { x: number; y: number } | null = null;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if hand tool is active and not in calibration
    if (editorState.activeTool !== 'hand' || editorState.calState !== 'idle') {
      return false;
    }

    // Start panning
    this.isPanning = true;
    this.lastPointerPosition = pt;
    
    return true;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if hand tool is active and panning
    if (editorState.activeTool !== 'hand' || 
        editorState.calState !== 'idle' || 
        !this.isPanning || 
        !this.lastPointerPosition) {
      return false;
    }

    // Calculate pan delta
    const dx = pt.x - this.lastPointerPosition.x;
    const dy = pt.y - this.lastPointerPosition.y;
    
    // Update pan
    this.store.setPan({
      x: editorState.pan.x + dx,
      y: editorState.pan.y + dy
    });
    
    this.lastPointerPosition = pt;
    return true;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle if hand tool is active
    if (editorState.activeTool !== 'hand' || editorState.calState !== 'idle') {
      return false;
    }

    // Stop panning
    this.isPanning = false;
    this.lastPointerPosition = null;
    
    return true;
  }

  onCancel(): void {
    // Stop any ongoing pan
    this.isPanning = false;
    this.lastPointerPosition = null;
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    // Hand tool doesn't handle special keys
    return false;
  }

  getCursor(): string {
    return this.isPanning ? 'grabbing' : 'grab';
  }
}