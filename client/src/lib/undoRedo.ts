/**
 * Production-ready Undo/Redo system for Canvas Editor
 * Implements efficient state management with structured cloning
 */

import { EditorMask, CalibrationData } from '@shared/schema';

export interface EditorOperation {
  id: string;
  type: 'mask' | 'material' | 'calibration' | 'transform' | 'batch';
  action: string;
  timestamp: number;
}

export interface EditorSnapshot {
  masks: EditorMask[];
  selectedMaskId?: string;
  calibration?: CalibrationData;
  timestamp: number;
  action: string;
  history?: EditorOperation[]; // Extended with history
}

export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

/**
 * Push new state to history with automatic cloning
 */
export function push(
  past: EditorSnapshot[], 
  present: EditorSnapshot, 
  next: EditorSnapshot, 
  limit: number = 50
): EditorHistory {
  const newPast = [...past, structuredClone(present)];
  if (newPast.length > limit) newPast.shift();
  
  return { 
    past: newPast, 
    present: structuredClone(next), 
    future: [] 
  };
}

/**
 * Step backward in history (undo)
 */
export function stepUndo(history: EditorHistory): EditorHistory {
  if (!history.past.length) return history;
  
  const prev = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  const future = [structuredClone(history.present), ...history.future];
  
  return { 
    past, 
    present: structuredClone(prev), 
    future 
  };
}

/**
 * Step forward in history (redo)
 */
export function stepRedo(history: EditorHistory): EditorHistory {
  if (!history.future.length) return history;
  
  const next = history.future[0];
  const future = history.future.slice(1);
  const past = [...history.past, structuredClone(history.present)];
  
  return { 
    past, 
    present: structuredClone(next), 
    future 
  };
}

/**
 * Create initial history state
 */
export function createInitialHistory(
  masks: EditorMask[] = [],
  calibration?: CalibrationData,
  selectedMaskId?: string
): EditorHistory {
  return {
    past: [],
    present: {
      masks: structuredClone(masks),
      selectedMaskId,
      calibration: calibration ? structuredClone(calibration) : undefined,
      timestamp: Date.now(),
      action: 'Initialize'
    },
    future: []
  };
}

/**
 * Create snapshot from current state
 */
export function createSnapshot(
  masks: EditorMask[],
  calibration?: CalibrationData,
  selectedMaskId?: string,
  action: string = 'Edit'
): EditorSnapshot {
  return {
    masks: structuredClone(masks),
    selectedMaskId,
    calibration: calibration ? structuredClone(calibration) : undefined,
    timestamp: Date.now(),
    action
  };
}

/**
 * Check if undo is available
 */
export function canUndo(history: EditorHistory): boolean {
  return history.past.length > 0;
}

/**
 * Check if redo is available
 */
export function canRedo(history: EditorHistory): boolean {
  return history.future.length > 0;
}

/**
 * Get the action that would be undone
 */
export function getUndoAction(history: EditorHistory): string | null {
  if (!history.past.length) return null;
  return history.past[history.past.length - 1].action;
}

/**
 * Get the action that would be redone
 */
export function getRedoAction(history: EditorHistory): string | null {
  if (!history.future.length) return null;
  return history.future[0].action;
}

/**
 * Legacy UndoRedoManager class for compatibility
 */
export class UndoRedoManager {
  private history: EditorHistory;
  
  constructor() {
    this.history = createInitialHistory();
  }
  
  pushState(masks: EditorMask[], calibration?: CalibrationData, selectedMaskId?: string, action: string = 'Edit') {
    const snapshot = createSnapshot(masks, calibration, selectedMaskId, action);
    this.history = push(this.history.past, this.history.present, snapshot);
  }
  
  undo(): EditorSnapshot | null {
    if (!canUndo(this.history)) return null;
    this.history = stepUndo(this.history);
    return this.history.present;
  }
  
  redo(): EditorSnapshot | null {
    if (!canRedo(this.history)) return null;
    this.history = stepRedo(this.history);
    return this.history.present;
  }
  
  canUndo(): boolean {
    return canUndo(this.history);
  }
  
  canRedo(): boolean {
    return canRedo(this.history);
  }
  
  getUndoAction(): string | null {
    return getUndoAction(this.history);
  }
  
  getRedoAction(): string | null {
    return getRedoAction(this.history);
  }
}