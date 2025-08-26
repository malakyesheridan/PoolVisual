/**
 * Production-ready Undo/Redo system for Canvas Editor
 */

import { EditorMask, CalibrationData } from '@shared/schema';

export interface EditorSnapshot {
  masks: EditorMask[];
  selectedMaskId?: string;
  calibration?: CalibrationData;
  timestamp: number;
  action: string;
}

export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

export class UndoRedoManager {
  private history: EditorHistory;
  private readonly maxHistorySize: number = 50;

  constructor(initialSnapshot?: EditorSnapshot) {
    this.history = {
      past: [],
      present: initialSnapshot || {
        masks: [],
        selectedMaskId: undefined,
        calibration: undefined,
        timestamp: Date.now(),
        action: 'Initial state'
      },
      future: []
    };
  }

  /**
   * Initialize with a state
   */
  initialize(masks: EditorMask[], calibration?: CalibrationData, selectedMaskId?: string): void {
    this.history = {
      past: [],
      present: {
        masks: this.deepClone(masks),
        selectedMaskId,
        calibration: calibration ? this.deepClone(calibration) : undefined,
        timestamp: Date.now(),
        action: 'Initialize'
      },
      future: []
    };
  }

  /**
   * Push a new state to history
   */
  pushState(
    masks: EditorMask[], 
    calibration?: CalibrationData, 
    selectedMaskId?: string,
    action: string = 'Unknown action'
  ): void {
    // Don't push identical states
    if (this.isStateIdentical(masks, calibration, selectedMaskId)) {
      return;
    }

    const newSnapshot: EditorSnapshot = {
      masks: this.deepClone(masks),
      selectedMaskId,
      calibration: calibration ? this.deepClone(calibration) : undefined,
      timestamp: Date.now(),
      action
    };

    this.history = {
      past: [...this.history.past, this.history.present].slice(-this.maxHistorySize),
      present: newSnapshot,
      future: [] // Clear future when new action is performed
    };
  }

  /**
   * Undo to previous state
   */
  undo(): EditorSnapshot | null {
    if (this.history.past.length === 0) return null;

    const previous = this.history.past[this.history.past.length - 1];
    const newPast = this.history.past.slice(0, -1);

    this.history = {
      past: newPast,
      present: previous,
      future: [this.history.present, ...this.history.future]
    };

    return this.deepClone(previous);
  }

  /**
   * Redo to next state
   */
  redo(): EditorSnapshot | null {
    if (this.history.future.length === 0) return null;

    const next = this.history.future[0];
    const newFuture = this.history.future.slice(1);

    this.history = {
      past: [...this.history.past, this.history.present],
      present: next,
      future: newFuture
    };

    return this.deepClone(next);
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.history.past.length > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.history.future.length > 0;
  }

  /**
   * Get the action that would be undone
   */
  getUndoAction(): string | null {
    if (this.history.past.length === 0) return null;
    return this.history.past[this.history.past.length - 1].action;
  }

  /**
   * Get the action that would be redone
   */
  getRedoAction(): string | null {
    if (this.history.future.length === 0) return null;
    return this.history.future[0].action;
  }

  /**
   * Get current state
   */
  getCurrentSnapshot(): EditorSnapshot {
    return this.deepClone(this.history.present);
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if state is identical to current
   */
  private isStateIdentical(
    masks: EditorMask[], 
    calibration?: CalibrationData, 
    selectedMaskId?: string
  ): boolean {
    const current = this.history.present;
    
    // Compare basic properties
    if (current.selectedMaskId !== selectedMaskId) return false;
    if (masks.length !== current.masks.length) return false;
    
    // Compare calibration
    if (JSON.stringify(calibration) !== JSON.stringify(current.calibration)) return false;
    
    // Compare masks (simplified comparison - in production you might want more sophisticated diffing)
    if (JSON.stringify(masks) !== JSON.stringify(current.masks)) return false;
    
    return true;
  }
}