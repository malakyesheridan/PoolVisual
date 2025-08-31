/**
 * PhotoSpace Store - Single Source of Truth for Transform
 * CONTRACT: All rendering (Konva and WebGL/Pixi) shares the same T = { S, originX, originY }
 * SAFETY: No other transforms allowed (no CSS transforms on WebGL canvas; no per-node offsets)
 */
import { create } from 'zustand';

export type PhotoTransform = { S: number; originX: number; originY: number };

type PhotoState = {
  imgW: number; imgH: number;
  containerW: number; containerH: number;
  fitScale: number; zoom: number; panX: number; panY: number;
  T: PhotoTransform;
  setImageSize: (w: number, h: number) => void;
  setContainer: (w: number, h: number) => void;
  setPan: (x: number, y: number) => void;
  setZoom: (z: number, anchorScr?: { x: number, y: number }) => void;
  recompute: () => void;
};

function computeT(s: PhotoState): PhotoTransform {
  const S = s.fitScale * s.zoom;
  const originX = s.panX + (s.containerW - s.imgW * S) / 2;
  const originY = s.panY + (s.containerH - s.imgH * S) / 2;
  return { S, originX, originY };
}

export const usePhoto = create<PhotoState>((set, get) => ({
  imgW: 1, imgH: 1, containerW: 1, containerH: 1, 
  fitScale: 1, zoom: 1, panX: 0, panY: 0,
  T: { S: 1, originX: 0, originY: 0 },
  
  setImageSize: (w, h) => { 
    set({ imgW: w, imgH: h }); 
    get().recompute(); 
  },
  
  setContainer: (w, h) => { 
    set({ containerW: w, containerH: h }); 
    get().recompute(); 
  },
  
  setPan: (x, y) => { 
    set({ panX: x, panY: y }); 
    get().recompute(); 
  },
  
  setZoom: (z, anchorScr) => {
    const s = get(); 
    const z1 = Math.max(0.2, Math.min(6, z)); // Clamp zoom 0.2..6
    
    if (!anchorScr) { 
      set({ zoom: z1 }); 
      get().recompute(); 
      return; 
    }
    
    // SAFETY: Zoom around cursor - keep same image point under cursor
    const T0 = s.T;
    const ix = (anchorScr.x - T0.originX) / T0.S;
    const iy = (anchorScr.y - T0.originY) / T0.S;
    const S1 = s.fitScale * z1;
    const originX1 = s.panX + (s.containerW - s.imgW * S1) / 2;
    const originY1 = s.panY + (s.containerH - s.imgH * S1) / 2;
    const sx0 = T0.originX + ix * T0.S, sy0 = T0.originY + iy * T0.S;
    const sx1 = originX1 + ix * S1, sy1 = originY1 + iy * S1;
    
    set({ 
      zoom: z1, 
      panX: s.panX + (sx0 - sx1), 
      panY: s.panY + (sy0 - sy1) 
    });
    get().recompute();
  },
  
  recompute: () => set(s => ({ T: computeT(s as PhotoState) })),
}));