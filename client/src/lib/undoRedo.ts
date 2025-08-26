/**
 * Undo/Redo system for Canvas Editor state management
 */

import { EditorMask, CalibrationData } from '@shared/schema';

export interface HistoryState {
  masks: EditorMask[];
  calibration?: CalibrationData;
  selectedMaskId?: string;
  timestamp: number;
  action: string;
}

export class UndoRedoManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  constructor(maxSize: number = 50) {
    this.maxHistorySize = maxSize;
  }

  /**
   * Push a new state to the history stack
   */
  pushState(
    masks: EditorMask[], 
    calibration?: CalibrationData, 
    selectedMaskId?: string,
    action: string = 'Unknown action'
  ): void {
    // Remove any states after current index (when undoing then making new changes)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Create deep copy of the state to prevent mutations
    const state: HistoryState = {
      masks: JSON.parse(JSON.stringify(masks)),
      calibration: calibration ? JSON.parse(JSON.stringify(calibration)) : undefined,
      selectedMaskId,
      timestamp: Date.now(),
      action
    };
    
    this.history.push(state);
    this.currentIndex = this.history.length - 1;
    
    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * Undo to previous state
   */
  undo(): HistoryState | null {
    if (!this.canUndo()) return null;
    
    this.currentIndex--;
    return this.getCurrentState();
  }

  /**
   * Redo to next state
   */
  redo(): HistoryState | null {
    if (!this.canRedo()) return null;
    
    this.currentIndex++;
    return this.getCurrentState();
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get current state
   */
  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Get the action that would be undone
   */
  getUndoAction(): string | null {
    if (!this.canUndo()) return null;
    return this.history[this.currentIndex]?.action || null;
  }

  /**
   * Get the action that would be redone
   */
  getRedoAction(): string | null {
    if (!this.canRedo()) return null;
    return this.history[this.currentIndex + 1]?.action || null;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get history info for debugging
   */
  getHistoryInfo(): {
    length: number;
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
    recentActions: string[];
  } {
    return {
      length: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      recentActions: this.history.slice(-5).map(state => state.action)
    };
  }

  /**
   * Initialize with an initial state
   */
  initialize(
    masks: EditorMask[], 
    calibration?: CalibrationData, 
    selectedMaskId?: string
  ): void {
    this.clear();
    this.pushState(masks, calibration, selectedMaskId, 'Initial state');
  }

  /**
   * Check if the state has changed significantly enough to warrant a new history entry
   */
  shouldPushState(
    newMasks: EditorMask[],
    newCalibration?: CalibrationData,
    newSelectedMaskId?: string,
    threshold: number = 5000 // 5 seconds
  ): boolean {
    const currentState = this.getCurrentState();
    if (!currentState) return true;
    
    // Always push if it's been more than threshold milliseconds
    if (Date.now() - currentState.timestamp > threshold) {
      return true;
    }
    
    // Push if masks count changed
    if (newMasks.length !== currentState.masks.length) {
      return true;
    }
    
    // Push if calibration changed
    if (!!newCalibration !== !!currentState.calibration) {
      return true;
    }
    
    // Push if selection changed
    if (newSelectedMaskId !== currentState.selectedMaskId) {
      return true;
    }
    
    return false;
  }
}