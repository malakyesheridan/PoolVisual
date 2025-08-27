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
    // F. CONTROLLER CONTRACTS - Hand returns false; Stage pan is handled by draggable stage
    return false;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    return false;
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