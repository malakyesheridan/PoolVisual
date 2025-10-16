import { screenToImage } from '../utils/mapping';
import { Point, pathContainsPoint } from './geometry';

export class MaskingEngine {
  private draft: { mode: 'area' | 'polygon'; pts: Point[] } | null = null;
  private listeners: Set<() => void> = new Set();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  begin(mode: 'area' | 'polygon'): void {
    this.draft = { mode, pts: [] };
    this.notify();
  }

  appendScreenPoint(
    clientX: number,
    clientY: number,
    viewportEl: HTMLElement,
    camera: { scale: number; panX: number; panY: number },
    dpr: number,
    imgFit: { originX: number; originY: number; imgScale: number }
  ): void {
    if (!this.draft) return;
    
    const p = screenToImage(clientX, clientY, viewportEl, camera, dpr, imgFit);
    const pts = this.draft.pts;
    
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      if (last) {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        if (Math.hypot(dx, dy) < 1.5) return;
      }
    }
    
    pts.push(p);
    this.notify();
  }

  backspace(): void {
    if (!this.draft) return;
    if (this.draft.pts.length) {
      this.draft.pts.pop();
      this.notify();
    }
  }

  cancel(): void {
    if (!this.draft) return;
    this.draft = null;
    this.notify();
  }

  canFinalize(): boolean {
    return !!this.draft && this.draft.pts.length >= 3;
  }

  finalize(): { id: string; mode: 'area' | 'polygon'; pts: Point[] } | null {
    if (!this.canFinalize()) return null;
    
    const out = {
      id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      mode: this.draft!.mode,
      pts: [...this.draft!.pts]
    };
    
    this.draft = null;
    this.notify();
    return out;
  }

  getDraft(): { mode: 'area' | 'polygon'; pts: Point[] } | null {
    return this.draft ? { mode: this.draft.mode, pts: [...this.draft.pts] } : null;
  }

  static hitTest(points: Point[], p: Point): boolean {
    return pathContainsPoint(points, p);
  }
}
