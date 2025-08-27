/**
 * Calibration Tool Controller
 * Handles the calibration state machine: placingA → placingB → lengthEntry → ready
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class CalibrationController implements ToolController {
  name = 'calibration' as const;

  constructor(private store: any) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Only handle events during calibration states
    if (editorState.calState === 'idle') {
      return false;
    }

    // Place calibration points
    if (editorState.calState === 'placingA' || editorState.calState === 'placingB') {
      this.store.placeCalPoint(pt);
      return true;
    }

    return false;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Show preview line when placing second point
    if (editorState.calState === 'placingB') {
      this.store.updateCalPreview(pt);
      return true;
    }

    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { editorState } = this.store;
    
    // Calibration handles its own state transitions
    return editorState.calState !== 'idle';
  }

  onCancel(): void {
    this.store.cancelCalibration();
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { editorState } = this.store;
    
    switch (code) {
      case 'Escape':
        if (editorState.calState !== 'idle') {
          this.onCancel();
          return true;
        }
        break;
        
      case 'Enter':
        if (editorState.calState === 'lengthEntry' && 
            editorState.calTemp?.meters && 
            editorState.calTemp.meters > 0) {
          this.store.commitCalSample();
          return true;
        }
        break;
    }
    
    return false;
  }

  getCursor(): string {
    const { editorState } = this.store;
    
    switch (editorState.calState) {
      case 'placingA':
      case 'placingB':
        return 'crosshair';
      case 'lengthEntry':
        return 'default';
      default:
        return 'default';
    }
  }
}