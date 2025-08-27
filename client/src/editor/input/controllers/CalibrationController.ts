/**
 * Calibration Tool Controller
 * Handles the calibration state machine: placingA → placingB → lengthEntry → idle
 * Fixed to work with the new bulletproof store structure
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { ToolController } from '../InputRouter';
import type { EditorSlice } from '@/stores/editorSlice';

export class CalibrationController implements ToolController {
  name = 'calibration' as const;

  constructor(private store: EditorSlice) {}

  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { calState } = this.store;
    
    // Only handle during active calibration states
    const isActive = calState === 'placingA' || 
                    calState === 'placingB' || 
                    calState === 'lengthEntry';
    
    if (!isActive) {
      return false;
    }

    // Place calibration points
    if (calState === 'placingA' || calState === 'placingB') {
      this.store.placeCalPoint(pt);
      console.log('[CalibrationController] Placed point', { calState, pt });
      return true;
    }

    return false;
  }

  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { calState } = this.store;
    
    // Show preview line when placing second point
    if (calState === 'placingB') {
      this.store.updateCalPreview(pt);
      return true;
    }

    return false;
  }

  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean {
    const { calState } = this.store;
    
    // Return true only during active calibration states to consume the event
    const isActive = calState === 'placingA' || 
                    calState === 'placingB' || 
                    calState === 'lengthEntry';
    
    return isActive;
  }

  onCancel(): void {
    this.store.cancelCalibration();
    console.log('[CalibrationController] Cancelled calibration');
  }

  onKey(code: string, e: KeyboardEvent): boolean {
    const { calState, calTemp } = this.store;
    
    switch (code) {
      case 'Escape':
        if (calState !== 'idle') {
          this.onCancel();
          return true;
        }
        break;
        
      case 'Enter':
        if (calState === 'lengthEntry' && calTemp?.meters && calTemp.meters > 0) {
          this.store.commitCalSample();
          console.log('[CalibrationController] Committed calibration sample');
          return true;
        }
        break;
    }
    
    return false;
  }

  getCursor(): string {
    const { calState } = this.store;
    
    switch (calState) {
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