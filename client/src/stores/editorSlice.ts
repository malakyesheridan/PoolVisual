/**
 * Editor Store - Bulletproof Implementation
 * Fixed all TypeScript strict mode errors and future-proofed for maintainability
 */

import { create } from 'zustand';
import type { Photo } from '@shared/schema';

// Core types - well-defined and future-proof
export type CalState = 'idle' | 'placingA' | 'placingB' | 'lengthEntry';
export type Vec2 = { x: number; y: number };
export type CalSample = { id: string; a: Vec2; b: Vec2; meters: number; ppm: number };

export type ToolType = 'hand' | 'area' | 'linear' | 'waterline' | 'eraser';

export interface EditorMask {
  id: string;
  photoId: string;
  type: 'area' | 'linear' | 'waterline_band';
  path: { points: Vec2[] };
  bandHeightM?: number;
}

// Main store interface - explicitly handles all optional properties
export interface EditorSlice {
  // Photo state
  photo: Photo | null;
  photoId: string | null;
  
  // Calibration - proper optional handling
  calState: CalState;
  calTemp: { a?: Vec2; b?: Vec2; preview?: Vec2; meters?: number } | null;
  calibration: { ppm: number; samples: CalSample[] } | null;
  
  // Tools & masks - future-proof structure
  activeTool: ToolType;
  transient: { tool: 'area' | 'linear' | 'waterline'; points: Vec2[] } | null;
  masks: EditorMask[];
  
  // UI state
  selectedMaskId: string | null;
  zoom: number;
  pan: Vec2;
  brushSize: number;
  
  // Actions - well-typed and error-safe
  startCalibration(): void;
  placeCalPoint(p: Vec2): void;
  updateCalPreview(p: Vec2): void;
  setCalMeters(m: number): void;
  commitCalSample(): Promise<void>;
  deleteCalSample(id: string): void;
  cancelCalibration(): void;
  
  startPath(tool: 'area' | 'linear' | 'waterline', p: Vec2): void;
  appendPoint(p: Vec2): void;
  commitPath(): void;
  cancelPath(): void;
  cancelAllTransient(): void;
  
  setActiveTool(tool: ToolType): void;
  setZoom(zoom: number): void;
  setPan(pan: Vec2): void;
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }): void;
  
  // Mask operations
  deleteMask(id: string): void;
  updatePathPreview(p: Vec2): void;
}

// Helper functions
function _distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

async function _persistCalibration(photoId: string, data: { ppm: number; sample: CalSample; samples: CalSample[] }) {
  try {
    const response = await fetch(`/api/photos/${photoId}/calibration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ppm: data.ppm, samples: data.samples })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error('[Calibration] persist failed:', error);
    throw error;
  }
}

// Store implementation - bulletproof with proper error handling
export const useEditorStore = create<EditorSlice>((set, get) => ({
  // Initial state - all properly typed
  photo: null,
  photoId: null,
  calState: 'idle',
  calTemp: null,
  calibration: null,
  activeTool: 'hand',
  transient: null,
  masks: [],
  selectedMaskId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  brushSize: 10,

  // Calibration actions - error-safe implementations
  startCalibration() {
    set({ calState: 'placingA', calTemp: {} });
    get().cancelAllTransient();
  },

  placeCalPoint(p: Vec2) {
    const s = get();
    if (s.calState === 'placingA') {
      set({ calTemp: { a: p, preview: p }, calState: 'placingB' });
    } else if (s.calState === 'placingB') {
      const currentTemp = s.calTemp || {};
      set({ calTemp: { ...currentTemp, b: p }, calState: 'lengthEntry' });
    }
  },

  updateCalPreview(p: Vec2) {
    const s = get();
    if (s.calState === 'placingB') {
      const currentTemp = s.calTemp || {};
      set({ calTemp: { ...currentTemp, preview: p } });
    }
  },

  setCalMeters(m: number) {
    const s = get();
    if (s.calState === 'lengthEntry') {
      const currentTemp = s.calTemp || {};
      set({ calTemp: { ...currentTemp, meters: m } });
    }
  },

  async commitCalSample() {
    const s = get();
    const temp = s.calTemp;
    if (!temp?.a || !temp?.b || !temp?.meters || temp.meters <= 0) return;

    const px = _distance(temp.a, temp.b);
    if (px < 10) {
      console.warn('[Calibration] Reference too short');
      return;
    }

    const ppm = px / temp.meters;
    const sample: CalSample = { 
      id: crypto.randomUUID(), 
      a: temp.a, 
      b: temp.b, 
      meters: temp.meters, 
      ppm 
    };

    // Update local state FIRST - bulletproof approach
    const prev = s.calibration?.samples ?? [];
    const samples = [...prev, sample];
    set({ 
      calibration: { ppm, samples }, 
      calState: 'idle', 
      calTemp: null 
    });
    
    console.info('[Calibration] committed ppm=', ppm.toFixed(4), 'samples=', samples.length);
    console.info('[Assert] ppm=', get().calibration?.ppm, 'calState=', get().calState);

    // Persist asynchronously - failure doesn't break UI
    if (s.photoId) {
      try {
        await _persistCalibration(s.photoId, { ppm, sample, samples });
      } catch (error) {
        console.error('[Calibration] persist failed, keeping local state');
      }
    }
  },

  deleteCalSample(id: string) {
    const curr = get().calibration?.samples ?? [];
    const samples = curr.filter(s => s.id !== id);
    if (samples.length > 0) {
      const ppm = samples[samples.length - 1].ppm;
      set({ calibration: { ppm, samples } });
    } else {
      set({ calibration: null });
    }
  },

  cancelCalibration() {
    set({ calState: 'idle', calTemp: null });
  },

  // Tool actions - bulletproof implementations
  startPath(tool: 'area' | 'linear' | 'waterline', p: Vec2) {
    set({ transient: { tool, points: [p] } });
  },

  appendPoint(p: Vec2) {
    const s = get();
    if (s.transient) {
      set({ 
        transient: { 
          ...s.transient, 
          points: [...s.transient.points, p] 
        } 
      });
    }
  },

  commitPath() {
    const s = get();
    const t = s.transient;
    if (!t || t.points.length < 2) {
      set({ transient: null });
      return;
    }

    const id = crypto.randomUUID();
    const mask: EditorMask = {
      id,
      photoId: s.photoId || 'temp',
      type: t.tool === 'waterline' ? 'waterline_band' : t.tool,
      path: { points: t.points.slice() },
      ...(t.tool === 'waterline' && { bandHeightM: 0.3 })
    };

    set({ 
      masks: [...s.masks, mask], 
      transient: null 
    });

    console.info('[Mask] commit', mask.type, 'count=', get().masks.length);
    console.info('[Assert] masks count=', get().masks.length);
  },

  cancelPath() {
    set({ transient: null });
  },

  cancelAllTransient() {
    set({ transient: null });
  },

  // Tool management - future-proof
  setActiveTool(tool: ToolType) {
    get().cancelAllTransient();
    set({ activeTool: tool });
  },

  // View controls
  setZoom(zoom: number) {
    set({ zoom: Math.max(0.1, Math.min(10, zoom)) }); // Bounded zoom
  },

  setPan(pan: Vec2) {
    set({ pan });
  },

  // Image loading - properly typed Photo interface
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }) {
    const photoId = `temp-${Date.now()}`;
    const photo: Photo = {
      id: photoId,
      jobId: 'temp-job',
      originalUrl: url, // Use originalUrl as expected by shared schema
      width: dimensions.width,
      height: dimensions.height,
      exifJson: null,
      calibrationPixelsPerMeter: null,
      calibrationMetaJson: null,
      createdAt: new Date() // Proper Date object
    };

    set({
      photo,
      photoId,
      masks: [],
      calibration: null,
      calState: 'idle',
      transient: null,
      selectedMaskId: null,
      zoom: 1,
      pan: { x: 0, y: 0 }
    });
  },

  // Mask operations - bulletproof implementations
  deleteMask(id: string) {
    const s = get();
    const masks = s.masks.filter(m => m.id !== id);
    set({ 
      masks,
      selectedMaskId: s.selectedMaskId === id ? null : s.selectedMaskId
    });
    console.info('[Mask] deleted', id, 'remaining=', masks.length);
  },

  updatePathPreview(p: Vec2) {
    // For now, this is a placeholder for live preview functionality
    // Will be used to show preview lines while drawing
    console.debug('[Path] preview update', p);
  }
}));