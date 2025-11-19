// client/src/services/presence/presenceService.ts
export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  selection?: string;
  lastSeen: number;
}

export interface PresenceState {
  users: PresenceUser[];
  currentUser: PresenceUser | null;
  isLocked: boolean;
  lockedBy?: string;
  lockExpiresAt?: number;
  connectionState: 'connecting' | 'degraded' | 'online' | 'offline';
}

export class PresenceService {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly PING_INTERVAL = 15000; // 15s
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000;
  
  async connect(projectId: string, userId: string): Promise<void> {
    this.updateConnectionState('connecting');
    await this.attemptConnect(projectId, userId);
  }
  
  private async attemptConnect(projectId: string, userId: string): Promise<void> {
    try {
      this.ws = new WebSocket(`/api/presence/${projectId}?userId=${userId}`);
      
      this.ws.onopen = () => {
        this.updateConnectionState('online');
        this.reconnectAttempts = 0;
        this.startPing();
      };
      
      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'presence_update') {
          this.handlePresenceUpdate(data.users);
        } else if (data.type === 'lock_acquired') {
          this.handleLockAcquired(data.userId, data.expiresAt);
        } else if (data.type === 'lock_released') {
          this.handleLockReleased();
        }
      };
      
      this.ws.onerror = () => {
        this.updateConnectionState('degraded');
      };
      
      this.ws.onclose = () => {
        this.updateConnectionState('offline');
        this.scheduleReconnect(projectId, userId);
      };
    } catch (error) {
      this.updateConnectionState('offline');
      this.scheduleReconnect(projectId, userId);
    }
  }
  
  private scheduleReconnect(projectId: string, userId: string): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.updateConnectionState('offline');
      return;
    }
    
    // Exponential backoff with jitter
    const baseDelay = this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.random() * 1000; // 0-1s jitter
    const delay = baseDelay + jitter;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.updateConnectionState('connecting');
      this.attemptConnect(projectId, userId);
    }, delay);
  }
  
  private updateConnectionState(state: 'connecting' | 'degraded' | 'online' | 'offline'): void {
    // Update presence store
    if (typeof window !== 'undefined' && (window as any).usePresenceStore) {
      (window as any).usePresenceStore.getState().setConnectionState(state);
    }
  }
  
  async acquireLock(projectId: string, userId: string): Promise<boolean> {
    const response = await fetch(`/api/presence/${projectId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'LOCKED') {
        return false;
      }
      throw new Error(error.message);
    }
    
    return true;
  }
  
  async releaseLock(projectId: string, userId: string): Promise<void> {
    await fetch(`/api/presence/${projectId}/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  }
  
  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }
  
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.PING_INTERVAL);
  }
  
  private handlePresenceUpdate(users: PresenceUser[]): void {
    // Update presence state
    if (typeof window !== 'undefined' && (window as any).usePresenceStore) {
      (window as any).usePresenceStore.getState().updateUsers(users);
    }
  }
  
  private handleLockAcquired(userId: string, expiresAt: number): void {
    if (typeof window !== 'undefined' && (window as any).usePresenceStore) {
      (window as any).usePresenceStore.getState().setLock(userId, expiresAt);
    }
  }
  
  private handleLockReleased(): void {
    if (typeof window !== 'undefined' && (window as any).usePresenceStore) {
      (window as any).usePresenceStore.getState().clearLock();
    }
  }
  
  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const presenceService = new PresenceService();

