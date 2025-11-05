/**
 * SSE Manager - Multi-viewer support with redundancy suppression
 */

type StreamEntry = { stream: NodeJS.WritableStream; createdAt: number };

export class SSEManager {
  private static streams = new Map<string, StreamEntry[]>();
  private static lastStatus = new Map<string, string>();
  private static reaper: NodeJS.Timeout | null = null;
  private static readonly MAX_TOTAL = 1000;
  private static readonly STALE_MS = 5 * 60 * 1000;

  static init() {
    if (this.reaper) return;
    
    this.reaper = setInterval(() => {
      const now = Date.now();
      for (const [jobId, list] of this.streams.entries()) {
        const kept = list.filter(e => now - e.createdAt <= this.STALE_MS);
        if (kept.length === 0) {
          this.streams.delete(jobId);
          this.lastStatus.delete(jobId);
        } else if (kept.length < list.length) {
          this.streams.set(jobId, kept);
        }
      }
    }, 60_000);
  }

  static register(jobId: string, res: NodeJS.WritableStream) {
    const total = Array.from(this.streams.values()).reduce((n, l) => n + l.length, 0);
    
    if (total >= this.MAX_TOTAL) {
      res.end('data: {"error":"Too many open streams"}\n\n');
      return;
    }
    
    const list = this.streams.get(jobId) ?? [];
    list.push({ stream: res, createdAt: Date.now() });
    this.streams.set(jobId, list);
    
    res.on('close', () => this._remove(jobId, res));
    res.on('error', () => this._remove(jobId, res));
  }

  private static _remove(jobId: string, s: NodeJS.WritableStream) {
    const list = this.streams.get(jobId);
    if (!list) return;
    
    const next = list.filter(e => e.stream !== s);
    if (next.length === 0) {
      this.streams.delete(jobId);
      this.lastStatus.delete(jobId);
    } else {
      this.streams.set(jobId, next);
    }
  }

  static emit(jobId: string, data: any) {
    // Suppress redundant failures
    if (data?.status === 'failed') {
      const last = this.lastStatus.get(jobId);
      if (last === 'failed') return; // Suppress redundant identical failures
    }
    
    this.lastStatus.set(jobId, data?.status ?? '');
    
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    const list = this.streams.get(jobId);
    
    if (!list) return;
    
    for (const { stream } of list) {
      try {
        stream.write(payload);
      } catch (error) {
        // Ignore write failures
      }
    }
  }

  static close(jobId: string) {
    this.lastStatus.delete(jobId);
    const list = this.streams.get(jobId);
    
    if (list) {
      for (const { stream } of list) {
        try {
          stream.end();
        } catch (error) {
          // Ignore
        }
      }
      this.streams.delete(jobId);
    }
  }

  static shutdown() {
    if (this.reaper) {
      clearInterval(this.reaper);
      this.reaper = null;
    }
    
    for (const [jobId] of this.streams) {
      this.close(jobId);
    }
    
    this.lastStatus.clear();
  }
}

