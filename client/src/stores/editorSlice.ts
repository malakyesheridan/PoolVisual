/**
 * Editor Store - Reliable, Testable Overhaul
 * Single source of truth with TypeScript strict mode
 */

import { create } from 'zustand';
import type { Photo } from '@shared/schema';
import { pickRepeatMeters } from '@/canvas/texture-utils';
import { useMaterialsStore } from '@/state/materialsStore';

// Canonical types exactly as specified
export type Tool = 'hand'|'area'|'linear'|'waterline'|'eraser';
export type CalState = 'idle'|'placingA'|'placingB'|'lengthEntry';
export type Vec2 = { x:number; y:number };

export type CalSample = { id:string; a:Vec2; b:Vec2; meters:number; ppm:number };

export type MaskType = 'area'|'linear'|'waterline_band';
export type Mask = {
  id:string; photoId:string; type:MaskType;
  path:{ points:Vec2[] }; bandHeightM?:number;
  createdAt:string;
  materialId?:string;
  materialMeta?: { scale: number; rotationDeg: number; offsetX: number; offsetY: number } | null;
};

export interface EditorSlice {
  photoId: string;
  activeTool: Tool;
  selectedMaskId: string | null;
  
  // Calibration
  calState: CalState;
  calTemp?: { a?:Vec2; b?:Vec2; preview?:Vec2; meters?:number } | undefined;
  calibration?: { ppm:number; samples:CalSample[] } | undefined;

  // Drawing
  transient?: { tool:'area'|'linear'|'waterline'; points:Vec2[] } | undefined;
  masks: Mask[];

  // Actions
  setTool(t:Tool): void;
  selectMask(id: string | null): void;
  applyMaterialToMask(maskId: string, materialId: string): void;

  startCalibration(): void;
  placeCalPoint(p:Vec2): void;
  updateCalPreview(p:Vec2): void;
  setCalMeters(m:number): void;
  commitCalSample(): Promise<void>;
  deleteCalSample(id:string): void;
  cancelCalibration(): void;

  startPath(tool:'area'|'linear'|'waterline', p:Vec2): void;
  appendPoint(p:Vec2): void;
  commitPath(): void;
  cancelPath(): void;
  cancelAllTransient(): void;
  deleteMask(id: string): void;

  // Legacy support
  photo: Photo | null;
  zoom: number;
  pan: Vec2;
  setZoom(zoom: number): void;
  setPan(pan: Vec2): void;
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }): void;
}

// Helper functions
const dist = (a:Vec2,b:Vec2)=>Math.hypot(b.x-a.x,b.y-a.y);

// Mock API calls - will be replaced with real endpoints
const api = {
  photos: {
    async setCalibration(photoId: string, data: { ppm: number; samples: CalSample[] }) {
      console.info('[API] persist calibration', photoId, data);
    }
  },
  masks: {
    async upsert(mask: Mask) {
      console.info('[API] persist mask', mask);
    }
  }
};

// Store implementation exactly as specified
export const useEditorStore = create<EditorSlice>((set, get) => ({
  // Initial state
  photoId: 'temp-photo',
  activeTool: 'hand',
  selectedMaskId: null,
  calState: 'idle',
  calTemp: undefined,
  calibration: undefined,
  transient: undefined,
  masks: [],

  // Legacy support
  photo: null,
  zoom: 1,
  pan: { x: 0, y: 0 },

  // Actions implemented exactly as specified
  setTool(t){ set(s=>{ if(s.activeTool!==t) return {...s, activeTool:t, transient:undefined}; return s; }); },
  selectMask(id){ set({ selectedMaskId: id }); },
  applyMaterialToMask(maskId, materialId) {
    set(state => {
      // Get material from materials store to calculate scaling
      const materialsStore = useMaterialsStore.getState();
      const material = materialsStore.items[materialId];
      
      let materialMeta = null;
      if (material) {
        // Calculate pixel scale based on calibration and material properties
        const ppm = state.calibration?.ppm || 120; // pixels per meter, fallback to reasonable default
        const repeatM = pickRepeatMeters(material);
        const repeatPx = repeatM * ppm;
        
        materialMeta = { 
          scale: repeatPx, 
          rotationDeg: 0, 
          offsetX: 0, 
          offsetY: 0 
        };
      }
      
      return {
        masks: state.masks.map(mask => 
          mask.id === maskId 
            ? { ...mask, materialId, materialMeta }
            : mask
        )
      };
    });
  },

  startCalibration(){ set(s=>({...s, calState:'placingA', calTemp:{}, transient:undefined })); },

  placeCalPoint(p){
    const s=get();
    if(s.calState==='placingA') set({ calTemp:{ a:p, preview:p }, calState:'placingB' });
    else if(s.calState==='placingB') set({ calTemp:{ ...s.calTemp, b:p }, calState:'lengthEntry' });
  },

  updateCalPreview(p){ if(get().calState==='placingB') set(s=>({ calTemp:{ ...s.calTemp, preview:p } })); },

  setCalMeters(m){ if(get().calState==='lengthEntry') set(s=>({ calTemp:{ ...s.calTemp, meters:m } })); },

  commitCalSample: async ()=>{
    const s=get(); const {a,b,meters}=s.calTemp || {};
    if(!a||!b||!meters||meters<=0) return;
    const px=dist(a,b); if(px<10) { console.warn('[Calibration] ref too short'); return; }
    const ppm=px/meters;
    const sample:CalSample={ id:crypto.randomUUID(), a,b,meters,ppm };
    const samples=[...(s.calibration?.samples||[]), sample];

    // Commit locally FIRST; calState back to idle so other tools work
    set(s=>({...s, calibration:{ ppm, samples }, calState:'idle', calTemp:undefined }));
    console.info('[Calibration] committed ppm=', ppm.toFixed(4), 'samples=', samples.length);

    // Persist async; never clear local ppm on failure
    try {
      await api.photos.setCalibration(s.photoId, { ppm, samples });
    } catch(err){ console.error('[Calibration] persist failed', err); }
  },

  deleteCalSample(id){
    const cur=get().calibration?.samples||[];
    const samples=cur.filter(x=>x.id!==id);
    if(!samples.length){ set(s=>({...s, calibration:undefined })); return; }
    const lastSample = samples[samples.length-1];
    if(lastSample) set(s=>({...s, calibration:{ ppm:lastSample.ppm, samples }}));
  },

  cancelCalibration(){ set(s=>({...s, calState:'idle', calTemp:undefined })); },

  startPath(tool,p){ set(s=>({...s, transient:{ tool, points:[p] } })); },
  appendPoint(p){ set(s=> s.transient ? ({ transient:{ ...s.transient, points:[...s.transient.points,p] } }) : ({})); },
  commitPath(){
    const s=get(); const t=s.transient;
    if(!t || t.points.length<2) { set(s=>({...s, transient:undefined })); return; }
    const id=crypto.randomUUID();
    const mask:Mask={
      id, photoId:s.photoId,
      type: t.tool==='waterline' ? 'waterline_band' : t.tool,
      path:{ points: t.points.slice() },
      createdAt: new Date().toISOString()
    };
    set(s=>({...s, masks:[...s.masks, mask], transient:undefined }));
    console.info('[Mask] commit', mask.type, 'count=', get().masks.length);
    api.masks.upsert(mask).catch(e=>console.error('[Mask] persist failed', e));
  },
  cancelPath(){ set(s=>({...s, transient:undefined })); },
  cancelAllTransient(){ set(s=>({...s, transient:undefined })); },

  deleteMask(id: string) {
    set(s=>({...s, masks: s.masks.filter(m => m.id !== id)}));
    console.info('[Mask] deleted', id);
  },

  // UI methods
  setZoom(zoom: number) {
    set(s=>({...s, zoom}));
  },

  setPan(pan: Vec2) {
    set(s=>({...s, pan}));
  },

  // Legacy support methods
  loadImageFile(file: File, url: string, dimensions: { width: number; height: number }) {
    const photoId = `temp-${Date.now()}`;
    const photo: Photo = {
      id: photoId,
      jobId: 'temp-job',
      originalUrl: url,
      width: dimensions.width,
      height: dimensions.height,
      exifJson: null,
      calibrationPixelsPerMeter: null,
      calibrationMetaJson: null,
      createdAt: new Date()
    };

    set(s=>({
      ...s,
      photo,
      photoId,
      masks: [],
      calibration: undefined,
      calState: 'idle',
      transient: undefined,
      zoom: 1,
      pan: { x: 0, y: 0 }
    }));
  }
}));