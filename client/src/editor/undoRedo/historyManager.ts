// client/src/editor/undoRedo/historyManager.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { EditorSnapshot, EditorOperation } from '../../lib/undoRedo';

interface HistoryDB extends DBSchema {
  checkpoints: {
    key: string;  // projectId
    value: {
      projectId: string;
      checkpoint: EditorSnapshot;
      timestamp: number;
      operationCount: number;
    };
  };
}

export class HistoryManager {
  private memoryHistory: EditorOperation[] = [];
  private historyIndex = -1;
  private readonly MAX_MEMORY_OPS = 50;
  private db: IDBPDatabase<HistoryDB> | null = null;
  private currentProjectId: string | null = null;

  async initialize(projectId: string) {
    this.currentProjectId = projectId;
    this.db = await openDB<HistoryDB>('editor-history', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('checkpoints')) {
          db.createObjectStore('checkpoints');
        }
      },
    });
    
    // Load checkpoint if exists - key by projectId
    const checkpoint = await this.db.get('checkpoints', projectId);
    if (checkpoint) {
      this.memoryHistory = checkpoint.checkpoint.history?.slice(-10) || [];
      this.historyIndex = this.memoryHistory.length - 1;
    }
  }

  push(operation: EditorOperation) {
    // Trim future if we're in the middle of history
    if (this.historyIndex < this.memoryHistory.length - 1) {
      this.memoryHistory = this.memoryHistory.slice(0, this.historyIndex + 1);
    }

    // Add new operation
    this.memoryHistory.push(operation);
    this.historyIndex = this.memoryHistory.length - 1;

    // Trim if exceeds max
    if (this.memoryHistory.length > this.MAX_MEMORY_OPS) {
      this.memoryHistory.shift();
      this.historyIndex--;
    }

    // Persist checkpoint every 10 operations
    if (this.memoryHistory.length % 10 === 0) {
      this.persistCheckpoint();
    }
  }

  async persistCheckpoint(snapshot?: EditorSnapshot) {
    if (!this.db || !this.currentProjectId) return;
    
    // If snapshot provided, use it; otherwise create minimal snapshot
    const checkpointSnapshot: EditorSnapshot = snapshot || {
      masks: [],
      timestamp: Date.now(),
      action: 'checkpoint',
      history: this.memoryHistory.slice(-10), // Last 10 ops for recovery
    };

    // Key by projectId
    await this.db.put('checkpoints', {
      projectId: this.currentProjectId,
      checkpoint: checkpointSnapshot,
      timestamp: Date.now(),
      operationCount: this.memoryHistory.length,
    }, this.currentProjectId);
  }

  undo(): EditorSnapshot | null {
    if (this.historyIndex < 0) return null;
    
    const operation = this.memoryHistory[this.historyIndex];
    this.historyIndex--;
    
    // Return snapshot from operation (would need to be stored)
    // For now, return null and let caller handle state restoration
    return null;
  }

  redo(): EditorSnapshot | null {
    if (this.historyIndex >= this.memoryHistory.length - 1) return null;
    
    this.historyIndex++;
    const operation = this.memoryHistory[this.historyIndex];
    
    // Return snapshot from operation
    return null;
  }

  canUndo(): boolean {
    return this.historyIndex >= 0;
  }

  canRedo(): boolean {
    return this.historyIndex < this.memoryHistory.length - 1;
  }

}

