/**
 * Editor Store - Stabilized Implementation
 * Follows exact specification for calibration and tool behavior
 */

import { create } from 'zustand';
import type { Vec2, Photo } from '@shared/schema';

// Core types
export type CalState = 'idle' | 'placingA' | 'placingB' | 'lengthEntry';
export type Vec2 = { x: number; y: number };
export type CalSample = { id: string; a: Vec2; b: Vec2; meters: number; ppm: number };

// Store interface
interface EditorSlice {
  // Photo state
  photo: Photo | null;
  photoId: string | null;
  
  // Calibration
  calState: CalState;
  calTemp?: { a?: Vec2; b?: Vec2; preview?: Vec2; meters?: number };
  calibration?: { ppm: number; samples: CalSample[] };
  
  // Tools & masks
  activeTool: 'hand' | 'area' | 'linear' | 'waterline' | 'eraser';
  transient?: { tool: 'area' | 'linear' | 'waterline'; points: Vec2[] };
  masks: Array<{ 
    id: string; 
    photoId: string; 
    type: 'area' | 'linear' | 'waterline_band'; 
    path: { points: Vec2[] }; 
    bandHeightM?: number 
  }>;
  
  // UI state
  selectedMaskId: string | null;
  zoom: number;
  pan: Vec2;
  
  // Actions
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
  
  setActiveTool(tool: EditorSlice['activeTool']): void;
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }): void;
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

// Store implementation
export const useEditorStore = create<EditorSlice>((set, get) => ({
  // Initial state
  photo: null,
  photoId: null,
  calState: 'idle',
  calibration: undefined,
  activeTool: 'hand',
  transient: undefined,
  masks: [],
  selectedMaskId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },

  // Calibration actions
  startCalibration() {
    set({ calState: 'placingA', calTemp: {} });
    get().cancelAllTransient();
  },

  placeCalPoint(p: Vec2) {
    const s = get();
    if (s.calState === 'placingA') {
      set({ calTemp: { a: p, preview: p }, calState: 'placingB' });
    } else if (s.calState === 'placingB') {
      set({ calTemp: { ...s.calTemp, b: p }, calState: 'lengthEntry' });
    }
  },

  updateCalPreview(p: Vec2) {
    const s = get();
    if (s.calState === 'placingB') {
      set({ calTemp: { ...s.calTemp, preview: p } });
    }
  },

  setCalMeters(m: number) {
    const s = get();
    if (s.calState === 'lengthEntry') {
      set({ calTemp: { ...s.calTemp, meters: m } });
    }
  },

  async commitCalSample() {
    const s = get();
    const { a, b, meters } = s.calTemp || {};
    if (!a || !b || !meters || meters <= 0) return;

    const px = _distance(a, b);
    if (px < 10) {
      console.warn('[Calibration] Reference too short');
      return;
    }

    const ppm = px / meters;
    const sample: CalSample = { 
      id: crypto.randomUUID(), 
      a, 
      b, 
      meters, 
      ppm 
    };

    // Update local state FIRST
    const prev = s.calibration?.samples ?? [];
    const samples = [...prev, sample];
    set({ 
      calibration: { ppm, samples }, 
      calState: 'idle', 
      calTemp: undefined 
    });
    
    console.info('[Calibration] committed ppm=', ppm.toFixed(4), 'samples=', samples.length);
    console.info('[Assert] ppm=', get().calibration?.ppm, 'calState=', get().calState);

    // Persist asynchronously
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
    const ppm = samples.length ? samples[samples.length - 1].ppm : undefined;
    set({ 
      calibration: samples.length && ppm ? { ppm, samples } : undefined 
    });
  },

  cancelCalibration() {
    set({ calState: 'idle', calTemp: undefined });
  },

  // Tool actions
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
      set({ transient: undefined });
      return;
    }

    const id = crypto.randomUUID();
    const mask = {
      id,
      photoId: s.photoId || 'temp',
      type: t.tool === 'waterline' ? 'waterline_band' as const : t.tool,
      path: { points: t.points.slice() },
      ...(t.tool === 'waterline' && { bandHeightM: 0.3 })
    };

    set({ 
      masks: [...s.masks, mask], 
      transient: undefined 
    });

    console.info('[Mask] commit', mask.type, 'count=', get().masks.length);
    console.info('[Assert] masks count=', get().masks.length);
  },

  cancelPath() {
    set({ transient: undefined });
  },

  cancelAllTransient() {
    set({ transient: undefined });
  },

  // Tool management
  setActiveTool(tool: EditorSlice['activeTool']) {
    get().cancelAllTransient();
    set({ activeTool: tool });
  },

  // Image loading
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }) {
    const photoId = `temp-${Date.now()}`;
    const photo: Photo = {
      id: photoId,
      jobId: 'temp-job',
      filename: file.name,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
      url: url,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    set({
      photo,
      photoId,
      masks: [],
      calibration: undefined,
      calState: 'idle',
      transient: undefined,
      selectedMaskId: null,
      zoom: 1,
      pan: { x: 0, y: 0 }
    });
  }
}));