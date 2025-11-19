// client/src/services/presence/lockManager.ts
import { presenceService } from './presenceService';

export class LockManager {
  private lockTimeout: NodeJS.Timeout | null = null;
  private readonly LOCK_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly LOCK_RENEWAL = 2 * 60 * 1000; // Renew 2 minutes before expiry
  private currentExpiresAt: number | null = null;
  
  async acquireSoftLock(projectId: string, userId: string): Promise<boolean> {
    const acquired = await presenceService.acquireLock(projectId, userId);
    
    if (acquired) {
      this.currentExpiresAt = Date.now() + this.LOCK_DURATION;
      this.startLockRenewal(projectId, userId);
      return true;
    }
    
    return false;
  }
  
  private startLockRenewal(projectId: string, userId: string): void {
    this.lockTimeout = setTimeout(async () => {
      await this.renewLock(projectId, userId);
    }, this.LOCK_DURATION - this.LOCK_RENEWAL);
  }
  
  async renewLock(projectId: string, userId: string): Promise<void> {
    const expiresAt = Date.now() + this.LOCK_DURATION;
    const response = await fetch(`/api/presence/${projectId}/lock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId,
        expiresAt, // Include expiresAt in renewal
      }),
    });
    
    if (response.ok) {
      const { expiresAt: serverExpiresAt } = await response.json();
      this.currentExpiresAt = serverExpiresAt;
      this.startLockRenewal(projectId, userId);
    } else {
      // Lock lost
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.warning('Lock lost - another user may have taken control');
      }
      this.currentExpiresAt = null;
    }
  }
  
  getExpiresAt(): number | null {
    return this.currentExpiresAt;
  }
  
  async releaseLock(projectId: string, userId: string): Promise<void> {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }
    
    this.currentExpiresAt = null;
    await presenceService.releaseLock(projectId, userId);
  }
}

export const lockManager = new LockManager();

