import { create } from 'zustand';

export type PhotoTransform = { S:number; originX:number; originY:number };
export type PhotoState = {
  imgW:number; imgH:number;
  containerW:number; containerH:number;
  fitScale:number; zoom:number; panX:number; panY:number;
  T: PhotoTransform;
  setContainer: (w:number,h:number)=>void;
  setPan: (x:number,y:number)=>void;
  setZoom: (z:number, anchorScr?:{x:number,y:number})=>void;
  recompute: ()=>void;
};

function makeT(s: Omit<PhotoState,'T'|'setContainer'|'setPan'|'setZoom'|'recompute'>): PhotoTransform {
  const S = s.fitScale * s.zoom;
  const originX = s.panX + (s.containerW - s.imgW * S) / 2;
  const originY = s.panY + (s.containerH - s.imgH * S) / 2;
  return { S, originX, originY };
}

export const usePhoto = create<PhotoState>((set, get) => ({
  imgW: 1, imgH: 1, containerW: 1, containerH: 1,
  fitScale: 1, zoom: 1, panX: 0, panY: 0,
  T: { S:1, originX:0, originY:0 },

  setContainer: (w,h) => { set({ containerW:w, containerH:h }); get().recompute(); },
  setPan: (x,y) => { set({ panX:x, panY:y }); get().recompute(); },
  setZoom: (z, anchorScr) => {
    const s = get(); const z0 = s.zoom; const z1 = Math.max(0.2, Math.min(6, z));
    if (!anchorScr) { set({ zoom:z1 }); get().recompute(); return; }
    // zoom around cursor: adjust pan to keep the same image point under cursor
    const T0 = s.T;
    const ix = (anchorScr.x - T0.originX) / T0.S;
    const iy = (anchorScr.y - T0.originY) / T0.S;
    const S1 = s.fitScale * z1;
    const originX1 = s.panX + (s.containerW - s.imgW * S1) / 2;
    const originY1 = s.panY + (s.containerH - s.imgH * S1) / 2;
    const sx0 = T0.originX + ix * T0.S;
    const sy0 = T0.originY + iy * T0.S;
    const sx1 = originX1 + ix * S1;
    const sy1 = originY1 + iy * S1;
    const panX = s.panX + (sx0 - sx1);
    const panY = s.panY + (sy0 - sy1);
    set({ zoom:z1, panX, panY }); get().recompute();
  },

  recompute: () => {
    const s = get();
    set({ T: makeT(s) });
  },
}));