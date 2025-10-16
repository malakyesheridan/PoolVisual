// Materials event bus for sync between Materials Library page and Canvas Editor

export interface MaterialsChangeEvent {
  reason: 'create' | 'update' | 'delete';
  ids: string[];
  ts: number;
}

class MaterialsEventBus {
  private listeners: Set<(event: MaterialsChangeEvent) => void> = new Set();

  // Subscribe to materials changes
  subscribe(listener: (event: MaterialsChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Broadcast materials changes
  broadcast(event: MaterialsChangeEvent): void {
    console.log('[MaterialsSync] broadcast', event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[MaterialsSync] listener error:', error);
      }
    });
  }

  // Convenience methods
  broadcastCreate(ids: string[]): void {
    this.broadcast({ reason: 'create', ids, ts: Date.now() });
  }

  broadcastUpdate(ids: string[]): void {
    this.broadcast({ reason: 'update', ids, ts: Date.now() });
  }

  broadcastDelete(ids: string[]): void {
    this.broadcast({ reason: 'delete', ids, ts: Date.now() });
  }
}

export const materialsEventBus = new MaterialsEventBus();
