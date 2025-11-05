/**
 * Safe Redis Mock for Testing
 * 
 * Provides in-memory Redis-like functionality for testing when Redis is unavailable
 * Mirrors the minimal Redis calls used by our services
 */

export class RedisMock {
  private data: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  async get(key: string): Promise<string | null> {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.data.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK'> {
    this.data.set(key, value);
    if (mode === 'EX' && ttl) {
      this.expirations.set(key, Date.now() + ttl * 1000);
    } else if (mode === 'PX' && ttl) {
      this.expirations.set(key, Date.now() + ttl);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    this.expirations.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const current = this.data.get(key);
    const newValue = current ? parseInt(current) + 1 : 1;
    this.data.set(key, newValue.toString());
    return newValue;
  }

  async pexpire(key: string, ttl: number): Promise<number> {
    if (this.data.has(key)) {
      this.expirations.set(key, Date.now() + ttl);
      return 1;
    }
    return 0;
  }

  // Mock connection methods
  async connect(): Promise<void> {
    console.log('[RedisMock] Connected to in-memory Redis');
  }

  async disconnect(): Promise<void> {
    console.log('[RedisMock] Disconnected from in-memory Redis');
  }

  on(event: string, callback: Function): void {
    console.log(`[RedisMock] Event listener registered for: ${event}`);
  }
}

// Export mock instance
export const redisMock = new RedisMock();
